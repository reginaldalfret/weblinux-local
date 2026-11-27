# Phase 14.2 — Alpine 3.24.4 Browser Qualification (`PHASE-02-ALPINE.md`)

## 1. Alpine v3.24 `riscv64` `APKINDEX` Package Audit

Queried directly from:
- `https://dl-cdn.alpinelinux.org/alpine/v3.24/main/riscv64/APKINDEX.tar.gz`
- `https://dl-cdn.alpinelinux.org/alpine/v3.24/community/riscv64/APKINDEX.tar.gz`

| Package | Repo | Version | Compressed Size | Engine / Toolkit | Key Dependencies & NOMMU/musl Notes |
|---|---|---|---|---|---|
| `epiphany` | `community` | `50.4-r0` | `1,102,867 B` | `webkit2gtk-6.0` (`2.48.1-r4`), GTK4 + `libadwaita` | Depends on `dbus:org.freedesktop.Secrets`, `gsettings-desktop-schemas`, `gst-plugins-good`, `libportal-gtk4.so.1`, `libwebkitgtk-6.0.so.4`, `libjavascriptcoregtk-6.0.so.1`. |
| `badwolf` | `community` | `1.4.0-r0` | `70,263 B` | `webkit2gtk-4.1` (`2.48.7-r0`), GTK3 | Lightweight minimalist browser; no `libportal`, no `libadwaita`, no `GTK4`, no `glycin-svg` dependency. |
| `vimb` | `community` | `3.7.0-r0` | `65,507 B` | `webkit2gtk-4.1` (`2.48.7-r0`), GTK3 | Vi-like WebKitGTK 4.1 browser. |
| `firefox-esr` | `community` | `153.7.0-r0` | `100,061,530 B` | Gecko / SpiderMonkey, GTK3 | Linked against **`so:libscudo.so`**, `libicui18n.so.78`, `ffmpeg7-libavcodec`. Scudo reserves large virtual address ranges (`mmap(PROT_NONE)`), which is hostile to `linux-wasm64_nommu-7.0` (no virtual-memory demand-zero overcommit) and 2048 MiB guest RAM. |
| `netsurf` | `community` | `3.11-r1` | `2,214,865 B` | NetSurf (GTK3) | Lightweight, incomplete modern JS/CSS support. |
| `dillo` | `community` | `3.3.0-r2` | `407,256 B` | FLTK 1.3 | No JavaScript engine. |
| `falkon` / `chromium` / `midori` | — | **Not packaged** | — | — | Absent from Alpine v3.24 `riscv64` `main` and `community` (`qt6-qtwebengine` is also absent on `riscv64`). |

Supporting runtime & portal packages verified in `v3.24` `riscv64`:
- `xdg-desktop-portal` `1.21.2-r0` (`community`, `341,321 B`)
- `xdg-desktop-portal-gtk` `1.15.3-r1` (`community`, `82,338 B`)
- `xdg-desktop-portal-kde` `6.6.6-r0` (`community`, `570,202 B`)
- `gvfs` `1.60.1-r0` (`community`, `510,505 B`)
- `gnome-keyring` `50.0-r0` (`community`, provides `dbus:org.freedesktop.Secrets`)
- `adwaita-icon-theme` `50.0-r1` (`community`, `1,895,218 B`, depends on `glycin-svg` `2.1.5-r0`)
- `font-noto` `2026.11.01-r0` (`community`, `4,690,395 B`)
- `dbus` `1.16.2-r2` (`main`, `119,552 B`), `dbus-x11` `1.16.2-r2` (`main`, `10,857 B`)

---

## 2. Why `epiphany 50.4-r0` Exited Silently Before `ps` in Phase 14.1

In Phase 14.1 (`p14-alpine-kde-result.json`), fixing BusyBox `%q`, `/root` `0711` traversal, `/tmp/runtime-browser`, and `dbus-run-session` eliminated both `sh: %q : invalid format` and `libportal-CRITICAL`, leaving `BROWSER_LOG` empty, yet `epiphany` exited before `ps`.

Key contributing factors on Alpine 3.24.4 (`musl` + `linux-wasm64_nommu-7.0`):
1. **musl libc 128 KiB default secondary thread stack:** Unlike glibc (which inherits `RLIMIT_STACK` / 8 MiB), musl hardcodes `DEFAULT_STACK_SIZE = 131072` (128 KiB) for `pthread_create()` when no explicit `pthread_attr_setstacksize` is provided. On NOMMU (which has no hardware guard pages), WebKitGTK 6.0 / JavaScriptCore / GTK4 worker threads can overflow 128 KiB or hit `WTF::StackBounds` / Wasm signal-trap assumptions and terminate silently (`dbus-run-session` forwards the child's exit code without printing a shell crash banner).
2. **JSC JIT / WebAssembly address-space reservations on NOMMU:** Without `JSC_useWebAssembly=0` alongside `JSC_useJIT=0`, JavaScriptCore attempts RWX/gigacage-style `mmap` reservations that fail or destabilize on `wasm64_nommu`.
3. **Missing `gvfs` (`1.60.1-r0`) & `gnome-keyring` (`50.0-r0`):** Neither `gvfs` nor an `org.freedesktop.Secrets` D-Bus provider (`gnome-keyring`) was present in `docs/phase-13/alpine-kde-packages.lock`.
4. **GTK4 + `glycin-svg` sandboxing:** `epiphany 50.4-r0` uses GTK4 (`4.22.4-r0`) + `libadwaita` (`1.9.2-r0`), whereas `badwolf 1.4.0-r0` uses GTK3 + `webkit2gtk-4.1` (`2.48.7-r0`) without `libportal-gtk4` or `glycin-svg`.

---

## 3. Changes Implemented in `scripts/install-alpine-browser.sh`

Created `E:\Web-Linux\weblinux-local\scripts\install-alpine-browser.sh` (without modifying shared manifests or running multi-GiB ext4 reconstruction):
1. **Signed package installation (`apk add --no-cache`, signature verification preserved):**
   - Installs/updates `epiphany` (`50.4-r0`), `badwolf` (`1.4.0-r0`, GTK3 + `webkit2gtk-4.1 2.48.7-r0` fallback), `xdg-desktop-portal` (`1.21.2-r0`), `xdg-desktop-portal-gtk` (`1.15.3-r1`), `gvfs` (`1.60.1-r0`), `gnome-keyring` (`50.0-r0`), `adwaita-icon-theme` (`50.0-r1`), and `font-noto` (`2026.11.01-r0`).
2. **POSIX `/usr/local/bin/weblinux-browser` (`#!/bin/sh`):**
   - Uses `chroot --userspec=browser:browser / /usr/bin/dbus-run-session -- "$BROWSER_BIN" "$@"` (no bashisms).
   - Sets `JSC_useJIT=0`, `JSC_useWebAssembly=0`, `WEBKIT_DISABLE_COMPOSITING_MODE=1`, `WEBKIT_DISABLE_DMABUF_RENDERER=1`, `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`, `GSK_RENDERER=cairo`, `LIBGL_ALWAYS_SOFTWARE=1`, `NO_AT_BRIDGE=1`, `GTK_A11Y=none`, and `ulimit -s 8192 2>/dev/null || true`.
   - Defaults `BROWSER_BIN` to `/usr/bin/epiphany`, with `WEBLINUX_BROWSER_ENGINE=badwolf` (or `WEBLINUX_BROWSER_BIN`) override to switch cleanly to `badwolf` (`webkit2gtk-4.1`) if `epiphany` (`webkit2gtk-6.0`) exits on musl+NOMMU.
3. **Filesystem verification & chunking:**
   - Runs `e2fsck -fy` on the reconstructed `alpine-kde.ext4`.
   - Slices 1 MiB 6-digit decimal chunks into `/mnt/d/weblinux-disks/alpine-kde` and writes `manifest.json` (with `present` hex bitmask) + `integrity.json` to both `/mnt/d/weblinux-disks/alpine-kde` and `/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/alpine-kde`, followed by round-trip SHA-256 verification.
