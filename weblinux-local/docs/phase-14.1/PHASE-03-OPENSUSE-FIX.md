# Phase 14.1 — openSUSE Tumbleweed Fix (`PHASE-03-OPENSUSE-FIX.md`)

## Chromium 155 NOMMU Diagnosis (`task-10148`, `task-10161`)
1. `/usr/bin/chromium` wrapper failed on bash process substitution (`/dev/fd/63: No such file or directory`).
2. Invoking `/usr/lib64/chromium/chrome` directly with `--no-sandbox --no-zygote --ozone-platform=wayland --disable-gpu --disable-dev-shm-usage` launched the browser (`PID 473`) and renderer (`PID 556`), but hit:
   - `rv: cannot copy the guest from the parent of a fork` (NOMMU cannot `fork()` without `execve()`)
   - `Network service crashed or was terminated, restarting service`
   - `rv: out of memory (the guest has 359 MiB and touched a page at 0x19dcfa70 that had none yet)` -> `rv: segmentation fault: address 0x19dcfa70 at pc 0x1dabf4e8`
3. This confirms Chromium 155 cannot run within `/bin/rv`'s current NOMMU `fork()` and 359 MiB per-guest memory limits.

## Alternative Signed Browser Fix (`task-10166`, `task-10173`)
- Checked `zypper search -s`: `epiphany 51.2-1.1` (`riscv64`) is available and GPG-signed in `openSUSE-Tumbleweed-Oss`.
- Installed `epiphany-51.2-1.1.riscv64` (+ 25 signed dependencies, `42.6 MiB` download), updated `/usr/local/bin/weblinux-browser` to launch `/usr/bin/dbus-run-session -- /usr/bin/epiphany "$@"` as `browser` (`uid=1000`, `setpriv`, `/tmp/runtime-browser`, `chmod 711 /root`), ran `e2fsck -fy` clean, and re-sliced (`522a94eccbca2ada14bac7021f98e9c9`, `4821` non-zero chunks).

## Live Verification (`tests/test-phase14-browser.js opensuse-tumbleweed-kde`, `task-10173`)
- **Cold Boot / Reload:** `24.6s` / `35.3s`
- **Binary & Network:** `/usr/bin/epiphany` (`Web 51.2`, RISC-V ELF64), `HTTP/2 200`, `RFC1918_BLOCKED_OK`.
- **Running Processes:** `dbus-run-session` (PID 450), `/usr/bin/epiphany https://example.com` (PID 468), `WebKitNetworkProcess` (PID 492), `Mem: 1204/2009 MiB` used.
- **OPFS Persistence:** **PASS** (`PHASE14_PERSIST_opensuse-tumbleweed-kde`, SHA-256 verified).
- **Limitation:** Unsandboxed (`WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`, `JSC_useJIT=0`); screenshot `p14-opensuse-tumbleweed-kde-example.png` captured before Plasma 6 compositor finished initial frame paint.
