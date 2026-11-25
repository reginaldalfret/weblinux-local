# Phase 8 — Final Qualification Report

**Date:** 2026-11-25  
**Branch:** `feature/runtime-foundations`  
**Host Browser:** Microsoft Edge (Playwright)

---

## 1. Summary of Outcomes

| Component | Target | Status | Observed Evidence |
|---|---|---|---|
| **Guest Networking Relay** | `ws://127.0.0.1:8081` SLIRP/DNS/TCP | **PASS** | `DNS: 104.20.23.154` / `172.66.147.243`; `HTTPS_STATUS: 200 TITLE_OK: True` (`https://example.com`); `RFC1918_BLOCK: OK URLError` |
| **Ubuntu 24.04.5 KDE + Epiphany** | `epiphany-browser` `46.0` (WebKitGTK 6.0) | **PARTIAL / LAUNCHES** | Boots in `22.1s–29.5s`; `epiphany` (`Web 46.5`) opens `1146x890` Wayland window with `https://example.com`, spawns `WebKitNetworkProcess` (`HTTP/2`) + `WebKitWebProcess`, uses `979–1101 MiB` RAM, creates `ephy-history.db` & `bookmarks.gvdb`. WebView page paint hits 10s `"Page Unresponsive"` dialog under NOMMU interpreter latency. |
| **Debian 13 + Firefox ESR** | `firefox-esr` `153.5.1esr` | **BLOCKED BY NOMMU** | `153 MiB` `libxul.so` requires `order 16` (`256 MiB`) contiguous allocation; `/proc/buddyinfo` has `0` `order 15/16` blocks once KDE Plasma 6 runs (`1310–1377 MiB` used, no `CONFIG_COMPACTION`), causing `XPCOMGlueLoad error`. Early `fork()` hits `rv: cannot copy the guest from the parent of a fork`. |
| **Shared Launcher & Manifests** | `/usr/local/bin/browser`, UI manifests | **PASS** | `debian-firefox.json`, `ubuntu-kde-epiphany.json`, `WasmLinuxAdapter.ts`, `App.tsx`, `DistributionSelector.tsx`, `DesktopSelector.tsx`, `vite.config.ts` wired with isolated root OPFS disks. |
| **Downloads & Persistence** | `curl` + `/dev/wdb` | **PARTIAL** | `curl` downloaded `example.html` (`577` bytes, SHA-256 `25ddf2c8...`) and file persisted across reboot; active SQLite/KDE writes during short `shutdown()` window caused ext4 directory checksum errors on `/dev/wdb`, mitigated by increasing flush delay to `1500ms`. |

---

## 2. Regression & Build Verification

- **Production Build (`npm run build` in `apps/web`):** `tsc && vite build` passed in `24.39s` (`2156` modules).
- **Phase 6.5.2 KDE Plasma Acceptance (`tests/test-phase652-acceptance.js`):** Exited `0` (cold runtime-ready `67s`, warm `27s`, `viewportFits: true`, `resizeResponsive: true`, clean shutdown `1.5s`).
- **Phase 7 RVGPU Regression (`tests/test-phase7-kde-rvgpu.js`):** Exited `0` (`Runtime ready in 23s`, `activeBackend: "vrend-webgl2"`, `commandRecords: 1253`, `submits: 100`, `errors: []`).
