# Phase 14.1 — Alpine 3.24.4 Fix (`PHASE-01-ALPINE-FIX.md`)

## Root Causes Identified
1. **`sh: %q : invalid format`:** BusyBox `ash` (`#!/bin/sh`) does not support `printf '%q '` (bashism) in `/usr/local/bin/weblinux-browser`.
2. **`libportal-CRITICAL: Failed to create XdpPortal instance: The connection is closed`:** `browser` (`uid=1000`) attempted to connect to root's D-Bus socket (`/tmp/runtime-root/bus`), which rejected cross-UID connections.
3. **`/root` traversal & `XDG_RUNTIME_DIR` ownership:** `/root` was `0700` (`Permission denied` for `uid=1000` accessing `/root/browser-home/.local/share/epiphany`) and `XDG_RUNTIME_DIR=/tmp/runtime-root` was owned by `uid=0`.

## Fix Implemented (Commit `f2dd744`)
- Replaced `su -c "... $(printf '%q ' "$@")"` with POSIX `chroot --userspec=browser:browser / /usr/bin/dbus-run-session -- /usr/bin/epiphany "$@"`.
- Added `chmod 711 /root` so `browser` can traverse `/root/browser-home` on persistent `/dev/wdb`.
- Created `browser`-owned `/tmp/runtime-browser` (`0700`) with `ln -sf /tmp/runtime-root/wayland-0 /tmp/runtime-browser/wayland-0`.
- Re-sliced `alpine-kde.ext4` (`e2fsck -fy` clean, `f154304fced1b1234b205b936c07b827`, `1695` non-zero chunks).

## Live Verification (`tests/test-phase14-browser.js alpine-kde`, `task-10103`)
- **Cold Boot / Reload:** `23.8s` / `36.4s`
- **Binary & Network:** `Web 50.4` (`ld-musl-riscv64.so.1` ELF64), `HTTP/2 200`, `RFC1918_BLOCKED_OK`.
- **OPFS Persistence:** **PASS** (`PHASE14_PERSIST_alpine-kde`, SHA-256 verified).
- **Remaining Runtime Limitation:** Both `sh: %q` and `libportal-CRITICAL` errors were eliminated (`BROWSER_LOG` clean), though `epiphany` exited without remaining resident in `ps` under Plasma 6.6.6.
