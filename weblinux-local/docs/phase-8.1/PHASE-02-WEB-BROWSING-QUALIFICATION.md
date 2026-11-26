# Phase 8.1 — Phase 2: Real Web Browsing Qualification

**Date:** 2026-11-26

---

## 1. Observed Live Browsing Results (Ubuntu 24.04.5 KDE + WebKitGTK 6.0)

| Target | Client | Observed Result | Guest RAM | Screenshot / Log |
|---|---|---|---|---|
| `https://example.com` | `MiniBrowser` (WebKitGTK 6.0) | **PASS — Full Visual Render** (`Example Domain` title, multi-language body text, `Learn more` link, icon) | `959 MiB` used / `2009 MiB` | `p81-01-minibrowser-95s.png` (`task-8042`) |
| `https://example.com` | `epiphany` (`Web 46.5`) | **PARTIAL** — GTK4 window + `https://example.com` URL bar + `WebKitNetworkProcess` (`HTTP/2`) + `WebKitWebProcess` active; 10s `"Page Unresponsive"` modal interrupts first paint | `979–1101 MiB` used | `p8-02-ubuntu-epiphany-rendered.png` (`task-7899`) |
| `https://example.com` | `python3` / `curl` | **PASS** — `DNS: 104.20.23.154` / `172.66.147.243`, `HTTPS_STATUS: 200`, `TITLE_OK: True`, `577` bytes SHA-256 `25ddf2c8...` | — | `test-phase8-epiphany.js` |
| `http://192.168.1.1` | `python3` | **PASS (Blocked)** — `RFC1918_BLOCK: OK URLError` | — | `test-phase8-epiphany.js` |
| `file:///tmp/js.html` | `MiniBrowser` | **PARTIAL** — `MiniBrowser`, `WebKitNetworkProcess`, `WebKitWebProcess` spawned (`1214 MiB` used); window still mapping at 70s (`task-8117`) | `1214 MiB` used | `task-8117` |
| `https://www.gnu.org` | `MiniBrowser` | **INCONCLUSIVE** — `Operation was cancelled` when previous `MiniBrowser` instance was still running (`1379 MiB` used, `task-8087`) | `1379 MiB` used | `p81-03-gnu-org.png` (`task-8087`) |
