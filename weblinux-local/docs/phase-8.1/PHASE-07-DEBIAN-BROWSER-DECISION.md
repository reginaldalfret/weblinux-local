# Phase 8.1 — Phase 7: Debian Browser Decision

**Date:** 2026-11-26  
**Decision:** **Option B / C — Keep Debian KDE Baseline Intact; Document Firefox ESR as `BLOCKED BY NOMMU`**

---

## 1. Rationale

1. [`debian-firefox.json`](file:///E:/Web-Linux/weblinux-local/apps/web/public/manifests/debian-firefox.json) and its isolated disk (`D:\weblinux-disks\debian-13-firefox\`) preserve the validated Debian 13 KDE baseline (`release`) untouched.
2. `firefox-esr` `153.5.1esr` cannot reliably load its `153 MiB` `libxul.so` on a `2048 MiB` NOMMU guest alongside KDE Plasma 6 (`0` `order 16` contiguous blocks, no `CONFIG_COMPACTION`), and Gecko's `fork()` fails in `/bin/rv` (`rv: cannot copy the guest from the parent of a fork`).
3. Meanwhile, Ubuntu 24.04.5's WebKitGTK 6.0 engine (`libwebkitgtk-6.0-4` + `MiniBrowser` / `epiphany-browser`) uses smaller modular shared libraries and `posix_spawn()`, fitting comfortably within `2048 MiB` (`959–1184 MiB` total guest RAM used).
4. Should a Debian-native browser be pursued in a future phase, `epiphany-browser` / WebKitGTK 6.0 from Debian Trixie `riscv64` (using `posix_spawn()` + `GSK_RENDERER=cairo` + `WEBKIT_DISABLE_COMPOSITING_MODE=1`) is the recommended architectural path rather than Gecko/Firefox ESR.
