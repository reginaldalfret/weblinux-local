# Phase 14.1 — Debian 13 Fix (`PHASE-00-DEBIAN-FIX.md`)

## Root Causes Identified
1. **`su: Authentication failure`:** `/usr/local/bin/weblinux-browser` invoked `su -s /bin/bash browser -c ...`, which failed PAM authentication inside the WebLinux chroot environment.
2. **Manifest & UI Naming:** `apps/web/public/manifests/debian-firefox.json` and `apps/web/src/pages/DistributionSelector.tsx` still labeled the profile `Debian GNU/Linux 13 (Trixie) + Firefox ESR` (`🦊`) even though Phase 14 installed `epiphany-browser 48.5-0+deb13u1`.
3. **`manifest.json` `present` bitmask:** Fixed missing `present` hex bitmask in `debian-13-firefox/manifest.json` and synced `integrity.json` (`ae6ca64d729f194adfb09e3edffdd939`, `4449` non-zero chunks).

## Fix Implemented (Commit `2fab210`)
- Replaced `su` with `setpriv --reuid="$BUID" --regid="$BGID" --clear-groups /usr/bin/epiphany "$@"` (no hardcoded passwords, unprivileged `uid=1000` `browser` user), exporting `DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus`, `GDK_BACKEND=wayland`, `GSK_RENDERER=cairo`, `LIBGL_ALWAYS_SOFTWARE=1`, `NO_AT_BRIDGE=1`, `GTK_A11Y=none`, `JSC_useJIT=0`, and `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`.
- Updated `debian-firefox.json` to `Debian GNU/Linux 13 (Trixie) + Epiphany Web` and `DistributionSelector.tsx` icon to `🌐`.

## Live Verification (`tests/test-phase14-browser.js debian-firefox`, `task-10062`)
- **Cold Boot / Reload:** `33.2s` / `16.3s`
- **Binary & Network:** `Web 48.5` (RISC-V ELF64), `HTTP/2 200` on `https://example.com`, `RFC1918_BLOCKED_OK`.
- **OPFS Persistence:** **PASS** (`PHASE14_PERSIST_debian-firefox`, SHA-256 verified).
- **Remaining Runtime Limitation:** `setpriv` executed cleanly (`su` error resolved), but launching `epiphany` after Plasma 6 startup (`used 1374/2009 MiB`) hit `/usr/bin/epiphany: error while loading shared libraries: libz.so.1: failed to map segment from shared object` under 2048 MiB NOMMU memory pressure.
