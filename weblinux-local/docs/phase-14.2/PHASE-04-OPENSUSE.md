# Phase 14.2 — openSUSE Tumbleweed Browser Qualification (`PHASE-04-OPENSUSE.md`)

## Summary
openSUSE Tumbleweed RISC-V (`opensuse-tumbleweed-kde`, Snapshot `20261106`, KDE Plasma `6.8.2`) ships and runs GPG-signed **GNOME Web (Epiphany) `51.2`** (`epiphany-51.2-1.1.riscv64` from `openSUSE-Tumbleweed-Oss`), launched via `/usr/local/bin/weblinux-browser` as unprivileged user `browser` (`uid=1000`, `gid=1000`).

- **Reproducible Installer Script:** [install-opensuse-browser.sh](file:///e:/Web-Linux/weblinux-local/scripts/install-opensuse-browser.sh)
- **Verification Artifact:** [p14-opensuse-tumbleweed-kde-result.json](file:///e:/Web-Linux/weblinux-local/tests/screenshots/phase14/p14-opensuse-tumbleweed-kde-result.json)
- **Status:** `PASS` (`task-10173`, `2026-11-27T12:02:58.154Z`)

## Package & Binary Provenance
- **Package:** `epiphany-51.2-1.1.riscv64` (+ 25 signed dependencies, `42.6 MiB` download) installed via `zypper --non-interactive install --no-recommends epiphany` with GPG signature verification enabled (never `--no-gpg-checks`).
- **Binary:** `/usr/bin/epiphany` (`4,680,224` bytes)
  - ELF: `ELF 64-bit LSB pie executable, UCB RISC-V, RVC, double-float ABI, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux-riscv64-lp64d.so.1`
  - BuildID: `e9cb09f425a73f1be9ecbcf6fcec92a403917925`
  - Version string: `Web 51.2`
- **Desktop Entry:** `/usr/share/applications/weblinux-browser.desktop` updated to `Name=Epiphany Web Browser` and `Icon=org.gnome.Epiphany`.

## Launcher & Runtime Configuration (`/usr/local/bin/weblinux-browser`)
- Drops privileges from `root` to `browser` (`uid=1000`, `gid=1000`) via `setpriv --reuid="$BUID" --regid="$BGID" --clear-groups` (with `chroot --userspec=browser:browser` fallback) and starts `/usr/bin/dbus-run-session -- /usr/bin/epiphany "$@"`.
- Uses isolated profile directories under `/root/browser-home` (`HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`, `Downloads`) and Wayland runtime dir `/tmp/runtime-browser` linked to `/tmp/runtime-root/wayland-0`.
- Sets NOMMU/software-rendering environment variables:
  - `GDK_BACKEND=wayland`, `WAYLAND_DISPLAY=wayland-0`, `GSK_RENDERER=cairo`, `LIBGL_ALWAYS_SOFTWARE=1`
  - `NO_AT_BRIDGE=1`, `GTK_A11Y=none`
  - `JSC_useJIT=0`, `WEBKIT_DISABLE_COMPOSITING_MODE=1`, `WEBKIT_DISABLE_DMABUF_RENDERER=1`, `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`

## Disk Image Integrity
Recorded in [integrity.json](file:///e:/Web-Linux/weblinux-local/apps/web/public/disk/opensuse-tumbleweed-kde/integrity.json) and [opensuse-tumbleweed-kde.json](file:///e:/Web-Linux/weblinux-local/apps/web/public/manifests/opensuse-tumbleweed-kde.json):
- **Manifest ID:** `522a94eccbca2ada14bac7021f98e9c9`
- **Full Image SHA-256:** `522a94eccbca2ada14bac7021f98e9c9392c2136e2b457dde00a9b0d64b49795`
- **Image Size:** `5,905,580,032` bytes (`5632` chunks x `1 MiB`)
- **Non-Zero Chunks:** `4821` (`bootChunks`: `64`)

## Live Browser Verification (`task-10173`)
- **Cold Boot / Warm Reload:** `24.6s` / `35.3s`
- **Network & Security:**
  - DNS + HTTPS: `example.com` resolved (`2606:4700:10::6814:179a`, `2606:4700:10::ac42:93f3`) and returned `HTTP/2 200` (`server: cloudflare`).
  - RFC1918 egress block: `RFC1918_BLOCKED_OK`.
- **Running Processes & Memory (`free -m`):**
  - `PID 450`: `/usr/bin/dbus-run-session -- /usr/bin/epiphany https://example.com` (`browser`)
  - `PID 468`: `/usr/bin/epiphany https://example.com` (`browser`)
  - `PID 492`: `/usr/libexec/libwebkitgtk-6_0-0/WebKitNetworkProcess 2 12` (`browser`)
  - Memory: `1204 MiB` used / `2009 MiB` total (`804 MiB` available)
- **OPFS Persistence:** `PHASE14_PERSIST_opensuse-tumbleweed-kde` verified across warm reload:
  - `/root/browser-home/Downloads/example.html` (`577` bytes, SHA-256 `25ddf2c883e0d1958ea971d279a7e4f0fd446724ee3db7db19dadabd4a62e484`)
  - `/root/browser-home/.config/p14-profile-marker.txt` (`40` bytes, SHA-256 `32431be95ddb57ed7bad9d054495fb4eee8e2daf9ad9419f0a7f56c24de217c8`)
- **Screenshots:**
  - `tests/screenshots/phase14/p14-opensuse-tumbleweed-kde-example.png`
  - `tests/screenshots/phase14/p14-opensuse-tumbleweed-kde-persisted.png`
- **Known Limitations:**
  - Runs unsandboxed (`WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`) and with JIT disabled (`JSC_useJIT=0`) due to `/bin/rv` NOMMU constraints.
  - `p14-opensuse-tumbleweed-kde-example.png` was captured before the Plasma 6 compositor finished its initial frame paint.
