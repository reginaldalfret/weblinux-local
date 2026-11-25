# Phase 8 — Phase 6: Web Compatibility & Networking Verification

**Date:** 2026-11-25

---

## 1. End-to-End Guest Networking & TLS

Verified inside both Debian 13 and Ubuntu 24.04.5 guests via [`tests/test-phase8-networking.js`](file:///E:/Web-Linux/weblinux-local/tests/test-phase8-networking.js) and [`tests/test-phase8-epiphany.js`](file:///E:/Web-Linux/weblinux-local/tests/test-phase8-epiphany.js):

1. **DNS Resolution:**
   - `10.0.5.1` UDP/53 DNS relay resolved `example.com` -> `104.20.23.154` / `172.66.147.243`.
   - `AAAA` (`qtype=28`) returns `NOERROR` with 0 answers to avoid IPv6 timeouts on the IPv4-only `10.0.5.2` guest.
2. **Real HTTPS / TLS Validation:**
   - Python `urllib.request.urlopen("https://example.com")` returned `HTTPS_STATUS: 200`, `TITLE_OK: True` (`Example Domain`) using the guest CA bundle (`/etc/ssl/certs/ca-certificates.crt`).
   - `curl -sL -o /root/Downloads/example.html https://example.com` downloaded `577` bytes with SHA-256 `25ddf2c883e0d1958ea971d279a7e4f0fd446724ee3db7db19dadabd4a62e484`.
   - Epiphany `WebKitNetworkProcess` established HTTP/2 + TLS (`libsoup-http2-DEBUG: [RECV] [SETTINGS]`).
3. **Security Isolation:**
   - `http://192.168.1.1` was blocked by [`scripts/guest-net-relay.js`](file:///E:/Web-Linux/weblinux-local/scripts/guest-net-relay.js) (`RFC1918_BLOCK: OK URLError`).
   - Loopback (`127.0.0.0/8`), RFC1918 (`10/8`, `172.16/12`, `192.168/16`), link-local (`169.254/16`), and multicast ranges are blocked.

---

## 2. Graphics Mode Compatibility (Software vs RVGPU)

- **GTK4 / Epiphany 46:**
  - Default GTK4 `ngl` / `gl` renderer stalls on software `llvmpipe` shader compilation under RISC-V NOMMU; `GSK_RENDERER=cairo` renders the GTK4/Libadwaita browser chrome cleanly.
  - Without `WEBKIT_DISABLE_COMPOSITING_MODE=1`, `WebKitWebProcess` EGL/Mesa initialization freezes the guest display after ~2m33s. With `WEBKIT_DISABLE_COMPOSITING_MODE=1` + `WEBKIT_DISABLE_DMABUF_RENDERER=1` + `LIBGL_ALWAYS_SOFTWARE=1`, the desktop remains stable.
- **KDE Plasma RVGPU:**
  - Verified independently in [`tests/test-phase7-kde-rvgpu.js`](file:///E:/Web-Linux/weblinux-local/tests/test-phase7-kde-rvgpu.js).
