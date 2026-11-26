# Phase 8.1 — Phase 0: Failure Reproduction & Diagnostics

**Date:** 2026-11-26  
**Target:** Ubuntu 24.04.5 LTS KDE + Epiphany Web (`46.5` / WebKitGTK `6.0`) and Debian 13 + Firefox ESR (`153.5.1esr`)

---

## 1. Epiphany First-Page Rendering Failure Reproduction

Reproduced in Microsoft Edge via [`tests/diag-phase81-epiphany.js`](file:///E:/Web-Linux/weblinux-local/tests/diag-phase81-epiphany.js) and [`tests/test-phase8-epiphany.js`](file:///E:/Web-Linux/weblinux-local/tests/test-phase8-epiphany.js):

### Observed Execution Sequence & Bottlenecks
1. **Epiphany Process Starts (`0s`):** `/usr/bin/epiphany https://example.com` spawns.
2. **First-Run Profile Migration (`0s–21s`):** `ephy-profile-migrator` runs 38 migrators synchronously on `/dev/wdb`, logging `Failed to search the password schema: GDBus.Error:org.freedesktop.DBus.Error.ServiceUnknown: The name org.freedesktop.secrets was not provided by any .service files`.
3. **Sandbox Path Warning (`~21s`):** Epiphany logs `CRITICAL: Attempted to add disallowed path to sandbox: /root/.config/epiphany`.
4. **WebView Creation & `WebKitWebProcess` Spawn (`~35s`):** `webkit_settings_set_enable_dns_prefetching is deprecated` logged; `WebKitWebProcess` spawns (`23` threads in `epiphany`).
5. **Secret Service Lookup Delay (`~35s–65s`):** Epiphany waits ~30s before logging `Failed to search secret storage: The name org.freedesktop.secrets was not provided by any .service files`, after which `WebKitNetworkProcess` (`HTTP/2`) spawns.
6. **10-Second Unresponsive Page Modal:** Because `WebKitWebProcess` + `plasmashell` startup compete for the 3 RISC-V NOMMU CPUs (`maxcpus=3`), initial WebView layout/paint exceeds Epiphany's 10-second responsiveness threshold, raising `"Page Unresponsive: The current page 'https://example.com/' is not responding"` over `"Set as Default Browser?"`.

### `/proc` & Memory Diagnostics (`task-7992`)
- `epiphany` (`PID 260`): `State: S (sleeping)`, `Threads: 23`, `fd 16 -> /dev/shm/.rv-memfd-gblmJl (deleted)`, `fd 23 -> /root/.local/share/epiphany/ephy-history.db`
- `WebKitWebProcess` (`PID 322`): `25%` CPU (`00:00:13`)
- `WebKitNetworkProcess` (`PID 348`): `56%` CPU (`00:00:18`)
- `MemTotal: 2057332 kB`, `MemFree: 556792 kB`, `MemAvailable: 789616 kB`, `Cached: 789916 kB`

---

## 2. Isolation Test with WebKitGTK 6.0 `MiniBrowser` (`task-8042`)

To separate WebKitGTK 6.0 rendering from Epiphany's migrator/Secret Service/unresponsive-dialog wrapper, `/usr/lib/riscv64-linux-gnu/webkitgtk-6.0/MiniBrowser https://example.com` was launched **after** Plasma settled (`105s` post-boot) with:
- `GSK_RENDERER=cairo`
- `WEBKIT_DISABLE_COMPOSITING_MODE=1`
- `WEBKIT_DISABLE_DMABUF_RENDERER=1`
- `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`
- `JSC_useJIT=0`, `LIBGL_ALWAYS_SOFTWARE=1`, `GTK_A11Y=none`

**Result (`p81-01-minibrowser-95s.png`):**
- `MiniBrowser` rendered **`https://example.com/` (`Example Domain`)** completely with full multi-language text, icon, and `Learn more` link inside Ubuntu KDE Plasma (`959 MiB` used out of `2009 MiB`, `1049 MiB` available, `0` log errors).
