# Phase 1 — Guest Networking

## 1. Architecture
- **Guest Interface:** `eth0` (`drivers/net/wasm_net.c`) configured at `10.0.5.2/24`, default gateway `10.0.5.1`, `/etc/resolv.conf` `nameserver 10.0.5.1`.
- **Browser Transport:** `apps/web/public/linux.js` forwards raw Ethernet frames over WebSocket (`ws://127.0.0.1:8081`) when `enableNetworking: true` (`App.tsx`).
- **Host Relay (`scripts/guest-net-relay.js`):**
  - Binds exclusively to `127.0.0.1:8081` with `Origin` allowlist (`localhost:3000`, `127.0.0.1:3000`).
  - Answers ARP `who-has 10.0.5.1` (`02:00:00:00:00:01`).
  - Filters `AAAA` (`qtype=28`) DNS queries with `NOERROR` 0-answer replies (IPv4-only guest) and forwards `A` DNS queries to `1.1.1.1:53`.
  - Blocks RFC1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), and multicast/reserved IPs.
  - Bridges outbound TCP sockets transparently (`MAX_TCP_CONNS=128`, `TCP_IDLE_MS=60000`) so the guest performs end-to-end TLS handshake and certificate validation.

## 2. Live Verification (`tests/test-phase8-networking.js`)
- **`eth0` & Routing:** `10.0.5.2`, gateway `10.0.5.1` on both Ubuntu KDE and Debian 13.
- **Debian 13 (`python3` + `curl`):**
  - `DNS: 104.20.23.154`
  - `HTTPS_STATUS: 200 TITLE_OK: True` (`https://example.com`)
  - `RFC1918_BLOCK: OK URLError` (`http://192.168.1.1` blocked)
