# Phase 8.1 — Phase 8: Guest Network Relay Security Review

**Date:** 2026-11-26  
**Implementation:** [`scripts/guest-net-relay.js`](file:///E:/Web-Linux/weblinux-local/scripts/guest-net-relay.js)

---

## 1. Security Boundary Architecture

1. **Bind & Origin Isolation:**
   - Binds exclusively to `127.0.0.1:8081` (not exposed on `0.0.0.0` or LAN interfaces).
   - Enforces `ALLOWED_ORIGINS` (`http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:5173`, `http://127.0.0.1:5173`).
2. **Protocol & Frame Filtering:**
   - Drops non-ARP / non-IPv4 Ethernet frames (including IPv6 `0x86dd`, preventing IPv4-mapped IPv6 bypasses at the guest link layer).
   - UDP is restricted strictly to DNS port `53` (`if (dstPort !== 53) return;`); arbitrary UDP probing is dropped.
   - `AAAA` (`qtype=28`) DNS queries receive an immediate `NOERROR` 0-answer response because the guest interface (`10.0.5.2`) is IPv4-only.
3. **Destination IP Filtering (`isBlockedIp`):**
   - Blocks `0.0.0.0/8`, `10.0.0.0/8` (RFC1918), `127.0.0.0/8` (loopback), `169.254.0.0/16` (link-local), `172.16.0.0/12` (RFC1918), `192.168.0.0/16` (RFC1918), and `>= 224.0.0.0` (multicast/reserved).
   - Any TCP SYN/packet targeting a blocked IP receives a synthetic `RST+ACK`, preventing DNS rebinding or HTTP redirect SSRF to host/LAN services.
   - Tested inside guest: `http://192.168.1.1` blocked (`RFC1918_BLOCK: OK URLError`).
4. **Resource Limits & TLS Integrity:**
   - `MAX_TCP_CONNS = 128`, `TCP_IDLE_MS = 60000`, `DNS_TIMEOUT_MS = 5000`, MTU-bounded WebSocket frames (`< 65536` bytes).
   - Raw TCP streams are forwarded end-to-end; TLS handshakes and certificate validation against `/etc/ssl/certs/ca-certificates.crt` occur inside the Linux guest without MITM or cert-validation bypass.
