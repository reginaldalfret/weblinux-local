#!/usr/bin/env node
/**
 * WebLinux Local — Isolated Userspace Ethernet-over-WebSocket Relay (SLIRP)
 *
 * Bridges raw Ethernet frames from linux.js (drivers/net/wasm_net.c) over
 * ws://127.0.0.1:8081 to real outbound DNS (UDP) and TCP/TLS sockets.
 *
 * Security boundaries:
 *  - Binds exclusively to 127.0.0.1:8081.
 *  - Enforces Origin allowlist (localhost:3000 / 127.0.0.1:3000).
 *  - Drops non-ARP / non-IPv4 frames.
 *  - Blocks RFC1918, loopback, link-local, and multicast destinations so guest
 *    processes cannot probe Windows host services or LAN hosts.
 *  - Forwards raw TCP bytes end-to-end; guest performs real TLS validation.
 */

const http = require('http');
const net = require('net');
const dgram = require('dgram');
const crypto = require('crypto');

const PORT = Number(process.env.RV_NET_PORT || 8081);
const HOST = '127.0.0.1';
const GW_MAC = Buffer.from([0x02, 0x00, 0x00, 0x00, 0x00, 0x01]);
const GW_IP = Buffer.from([10, 0, 5, 1]);
const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const UPSTREAM_DNS = process.env.RV_DNS || '1.1.1.1';
const MAX_TCP_CONNS = 128;
const TCP_IDLE_MS = 60000;
const DNS_TIMEOUT_MS = 5000;

function isBlockedIp(ipBuf) {
  const a = ipBuf[0], b = ipBuf[1];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true; // Multicast / reserved
  return false;
}

function ipToStr(b) {
  return `${b[0]}.${b[1]}.${b[2]}.${b[3]}`;
}

function checksum(buf, init = 0) {
  let sum = init;
  for (let i = 0; i + 1 < buf.length; i += 2) {
    sum += buf.readUInt16BE(i);
  }
  if (buf.length & 1) {
    sum += buf[buf.length - 1] << 8;
  }
  while (sum >>> 16) {
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  return (~sum) & 0xffff;
}

function tcpUdpChecksum(srcIp, dstIp, proto, payload) {
  let sum = 0;
  sum += srcIp.readUInt16BE(0) + srcIp.readUInt16BE(2);
  sum += dstIp.readUInt16BE(0) + dstIp.readUInt16BE(2);
  sum += proto;
  sum += payload.length;
  return checksum(payload, sum);
}

function buildIpv4Frame(dstMac, srcMac, srcIp, dstIp, proto, payload) {
  const ip = Buffer.alloc(20 + payload.length);
  ip[0] = 0x45;
  ip[1] = 0x00;
  ip.writeUInt16BE(ip.length, 2);
  ip.writeUInt16BE(Math.floor(Math.random() * 65535), 4);
  ip.writeUInt16BE(0x4000, 6); // DF
  ip[8] = 64; // TTL
  ip[9] = proto;
  ip.writeUInt16BE(0, 10);
  srcIp.copy(ip, 12);
  dstIp.copy(ip, 16);
  ip.writeUInt16BE(checksum(ip.subarray(0, 20)), 10);
  payload.copy(ip, 20);

  const eth = Buffer.alloc(14 + ip.length);
  dstMac.copy(eth, 0);
  srcMac.copy(eth, 6);
  eth.writeUInt16BE(0x0800, 12);
  ip.copy(eth, 14);
  return eth;
}

function sendWsFrame(socket, payload) {
  if (socket.destroyed || !socket.writable) return;
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x82, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x82;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    return; // Exceeds Ethernet MTU
  }
  socket.write(Buffer.concat([header, payload]));
}

function handleSession(wsSocket) {
  let guestMac = null;
  let guestIp = null;
  const tcpConns = new Map(); // key: `${srcPort}:${dstIpStr}:${dstPort}`

  const cleanupAll = () => {
    for (const c of tcpConns.values()) {
      clearTimeout(c.timer);
      c.sock.destroy();
    }
    tcpConns.clear();
  };

  function sendTcpSegment(conn, flags, data = Buffer.alloc(0)) {
    if (!guestMac || !guestIp) return;
    const tcp = Buffer.alloc(20 + data.length);
    tcp.writeUInt16BE(conn.dstPort, 0);
    tcp.writeUInt16BE(conn.srcPort, 2);
    tcp.writeUInt32BE(conn.seq >>> 0, 4);
    tcp.writeUInt32BE(conn.ack >>> 0, 8);
    tcp[12] = 0x50; // 20 bytes header
    tcp[13] = flags;
    tcp.writeUInt16BE(65535, 14);
    tcp.writeUInt16BE(0, 16);
    tcp.writeUInt16BE(0, 18);
    if (data.length) data.copy(tcp, 20);
    tcp.writeUInt16BE(tcpUdpChecksum(conn.dstIp, guestIp, 6, tcp), 16);
    const frame = buildIpv4Frame(guestMac, GW_MAC, conn.dstIp, guestIp, 6, tcp);
    sendWsFrame(wsSocket, frame);
  }

  function handleEthFrame(frame) {
    if (frame.length < 14) return;
    const srcMac = Buffer.from(frame.subarray(6, 12));
    const ethType = frame.readUInt16BE(12);

    // 1. ARP
    if (ethType === 0x0806 && frame.length >= 42) {
      const oper = frame.readUInt16BE(20);
      const sha = frame.subarray(22, 28);
      const spa = Buffer.from(frame.subarray(28, 32));
      const tpa = frame.subarray(38, 42);
      guestMac = Buffer.from(sha);
      guestIp = spa;
      if (oper === 1 && tpa.equals(GW_IP)) {
        const reply = Buffer.alloc(42);
        sha.copy(reply, 0);
        GW_MAC.copy(reply, 6);
        reply.writeUInt16BE(0x0806, 12);
        reply.writeUInt16BE(1, 14);
        reply.writeUInt16BE(0x0800, 16);
        reply[18] = 6;
        reply[19] = 4;
        reply.writeUInt16BE(2, 20); // Reply
        GW_MAC.copy(reply, 22);
        GW_IP.copy(reply, 28);
        sha.copy(reply, 32);
        spa.copy(reply, 38);
        sendWsFrame(wsSocket, reply);
      }
      return;
    }

    // 2. IPv4
    if (ethType !== 0x0800 || frame.length < 34) return;
    const ip = frame.subarray(14);
    const ihl = (ip[0] & 0x0f) * 4;
    const totalLen = ip.readUInt16BE(2);
    if (ihl < 20 || totalLen > ip.length) return;
    const proto = ip[9];
    const srcIp = Buffer.from(ip.subarray(12, 16));
    const dstIp = Buffer.from(ip.subarray(16, 20));
    guestMac = srcMac;
    guestIp = srcIp;

    const payload = ip.subarray(ihl, totalLen);

    // 2a. UDP (DNS port 53)
    if (proto === 17 && payload.length >= 8) {
      const srcPort = payload.readUInt16BE(0);
      const dstPort = payload.readUInt16BE(2);
      const udpLen = payload.readUInt16BE(4);
      const udpData = payload.subarray(8, udpLen);
      if (dstPort !== 53) return; // Only DNS UDP allowed
      // Check DNS QTYPE: if AAAA (28), reply immediately with NOERROR 0 answers (guest is IPv4-only 10.0.5.2)
      if (udpData.length >= 17) {
        let pos = 12;
        while (pos < udpData.length && udpData[pos] !== 0) {
          pos += (udpData[pos] & 0xc0) ? 2 : (udpData[pos] + 1);
          if (udpData[pos - 1] & 0xc0) break;
        }
        if (pos + 4 < udpData.length) {
          const qtype = udpData.readUInt16BE(pos + 1);
          if (qtype === 28) {
            const resp = Buffer.from(udpData);
            resp[2] = 0x81; // QR=1, RD=1
            resp[3] = 0x80; // RA=1, RCODE=0
            resp.writeUInt16BE(0, 6); // ANCOUNT=0
            resp.writeUInt16BE(0, 8);
            resp.writeUInt16BE(0, 10);
            const udp = Buffer.alloc(8 + resp.length);
            udp.writeUInt16BE(dstPort, 0);
            udp.writeUInt16BE(srcPort, 2);
            udp.writeUInt16BE(udp.length, 4);
            udp.writeUInt16BE(0, 6);
            resp.copy(udp, 8);
            udp.writeUInt16BE(tcpUdpChecksum(dstIp, srcIp, 17, udp), 6);
            sendWsFrame(wsSocket, buildIpv4Frame(srcMac, GW_MAC, dstIp, srcIp, 17, udp));
            return;
          }
        }
      }
      const dnsSock = dgram.createSocket('udp4');
      const timer = setTimeout(() => { try { dnsSock.close(); } catch {} }, DNS_TIMEOUT_MS);
      dnsSock.on('message', (msg) => {
        clearTimeout(timer);
        try { dnsSock.close(); } catch {}
        const udp = Buffer.alloc(8 + msg.length);
        udp.writeUInt16BE(dstPort, 0);
        udp.writeUInt16BE(srcPort, 2);
        udp.writeUInt16BE(udp.length, 4);
        udp.writeUInt16BE(0, 6);
        msg.copy(udp, 8);
        udp.writeUInt16BE(tcpUdpChecksum(dstIp, srcIp, 17, udp), 6);
        sendWsFrame(wsSocket, buildIpv4Frame(srcMac, GW_MAC, dstIp, srcIp, 17, udp));
      });
      dnsSock.on('error', () => { clearTimeout(timer); try { dnsSock.close(); } catch {} });
      const targetDns = dstIp.equals(GW_IP) || isBlockedIp(dstIp) ? UPSTREAM_DNS : ipToStr(dstIp);
      dnsSock.send(udpData, 53, targetDns);
      return;
    }

    // 2b. TCP
    if (proto === 6 && payload.length >= 20) {
      const srcPort = payload.readUInt16BE(0);
      const dstPort = payload.readUInt16BE(2);
      const seq = payload.readUInt32BE(4);
      const ack = payload.readUInt32BE(8);
      const dataOff = ((payload[12] >>> 4) & 0x0f) * 4;
      const flags = payload[13];
      const data = payload.subarray(dataOff);
      const dstIpStr = ipToStr(dstIp);

      if (isBlockedIp(dstIp)) {
        // Send RST for blocked internal/private IPs
        const rst = { srcPort, dstPort, dstIp, seq: ack, ack: (seq + 1) >>> 0 };
        sendTcpSegment(rst, 0x14); // RST+ACK
        return;
      }

      const key = `${srcPort}:${dstIpStr}:${dstPort}`;
      const isSyn = (flags & 0x02) !== 0 && (flags & 0x10) === 0;
      const isFin = (flags & 0x01) !== 0;
      const isRst = (flags & 0x04) !== 0;

      if (isSyn) {
        if (tcpConns.has(key)) {
          const old = tcpConns.get(key);
          clearTimeout(old.timer);
          old.sock.destroy();
          tcpConns.delete(key);
        }
        if (tcpConns.size >= MAX_TCP_CONNS) {
          sendTcpSegment({ srcPort, dstPort, dstIp, seq: 0, ack: (seq + 1) >>> 0 }, 0x14);
          return;
        }
        const sock = net.createConnection({ host: dstIpStr, port: dstPort });
        const conn = {
          key,
          srcPort,
          dstPort,
          dstIp,
          sock,
          seq: crypto.randomBytes(4).readUInt32BE(0),
          ack: (seq + 1) >>> 0,
          established: false,
          timer: null,
        };
        const resetTimer = () => {
          clearTimeout(conn.timer);
          conn.timer = setTimeout(() => {
            sendTcpSegment(conn, 0x14);
            sock.destroy();
            tcpConns.delete(key);
          }, TCP_IDLE_MS);
        };
        resetTimer();
        tcpConns.set(key, conn);

        sock.on('connect', () => {
          conn.established = true;
          sendTcpSegment(conn, 0x12); // SYN+ACK
          conn.seq = (conn.seq + 1) >>> 0;
        });
        sock.on('data', (chunk) => {
          resetTimer();
          // Segment into <= 1400 byte Ethernet-friendly chunks
          for (let off = 0; off < chunk.length; off += 1400) {
            const slice = chunk.subarray(off, Math.min(off + 1400, chunk.length));
            sendTcpSegment(conn, 0x18, slice); // PSH+ACK
            conn.seq = (conn.seq + slice.length) >>> 0;
          }
        });
        sock.on('end', () => {
          sendTcpSegment(conn, 0x11); // FIN+ACK
          conn.seq = (conn.seq + 1) >>> 0;
        });
        sock.on('error', () => {
          clearTimeout(conn.timer);
          sendTcpSegment(conn, 0x14);
          tcpConns.delete(key);
        });
        sock.on('close', () => {
          clearTimeout(conn.timer);
          tcpConns.delete(key);
        });
        return;
      }

      const conn = tcpConns.get(key);
      if (!conn) {
        if (!isRst) {
          sendTcpSegment({ srcPort, dstPort, dstIp, seq: ack, ack: (seq + data.length) >>> 0 }, 0x04);
        }
        return;
      }
      clearTimeout(conn.timer);
      conn.timer = setTimeout(() => {
        sendTcpSegment(conn, 0x14);
        conn.sock.destroy();
        tcpConns.delete(key);
      }, TCP_IDLE_MS);

      if (isRst) {
        clearTimeout(conn.timer);
        conn.sock.destroy();
        tcpConns.delete(key);
        return;
      }
      if (data.length > 0) {
        if (seq === conn.ack) {
          conn.ack = (conn.ack + data.length) >>> 0;
          conn.sock.write(data);
          sendTcpSegment(conn, 0x10); // ACK
        } else {
          // Out-of-order: re-ACK expected seq
          sendTcpSegment(conn, 0x10);
        }
      }
      if (isFin) {
        conn.ack = (conn.ack + 1) >>> 0;
        sendTcpSegment(conn, 0x10);
        conn.sock.end();
      }
    }
  }

  // RFC 6455 WebSocket frame parser
  let rxBuf = Buffer.alloc(0);
  wsSocket.on('data', (chunk) => {
    rxBuf = Buffer.concat([rxBuf, chunk]);
    while (rxBuf.length >= 2) {
      const b0 = rxBuf[0];
      const b1 = rxBuf[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (rxBuf.length < 4) return;
        len = rxBuf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        wsSocket.destroy();
        return;
      }
      const need = off + (masked ? 4 : 0) + len;
      if (rxBuf.length < need) return;
      let payload = rxBuf.subarray(off + (masked ? 4 : 0), need);
      if (masked) {
        const mask = rxBuf.subarray(off, off + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      rxBuf = rxBuf.subarray(need);

      if (opcode === 8) { // Close
        cleanupAll();
        wsSocket.end();
        return;
      } else if (opcode === 9) { // Ping
        const pong = Buffer.from([0x8a, payload.length]);
        wsSocket.write(Buffer.concat([pong, payload]));
      } else if (opcode === 2) { // Binary Ethernet frame
        try {
          handleEthFrame(payload);
        } catch (err) {
          console.error('[Relay] Frame error:', err.message);
        }
      }
    }
  });

  wsSocket.on('close', cleanupAll);
  wsSocket.on('error', cleanupAll);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, host: HOST, port: PORT, upstreamDns: UPSTREAM_DNS }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.on('upgrade', (req, socket) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    console.warn(`[Relay] Rejected WebSocket origin: ${origin}`);
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  handleSession(socket);
});

server.listen(PORT, HOST, () => {
  console.log(`[GuestNetRelay] Listening on ws://${HOST}:${PORT} (DNS: ${UPSTREAM_DNS}, RFC1918 blocked)`);
});
