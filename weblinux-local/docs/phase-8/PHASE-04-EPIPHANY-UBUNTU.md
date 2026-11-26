# Phase 8 — Phase 4: Ubuntu 24.04.5 LTS KDE + Epiphany Web (`epiphany-browser`)

**Date:** 2026-11-25  
**Target Distribution:** Ubuntu 24.04.5 LTS (Noble Numbat) KDE Plasma 5.27 `riscv64`  
**Package:** `epiphany-browser` `46.0-2build1` / WebKitGTK 6.0 (276-package official Ubuntu `riscv64` closure)  
**Manifest:** [`apps/web/public/manifests/ubuntu-kde-epiphany.json`](file:///E:/Web-Linux/weblinux-local/apps/web/public/manifests/ubuntu-kde-epiphany.json)  
**Disk Chunks:** `D:\weblinux-disks\ubuntu-24.04-kde-epiphany\` (`3584` x 1 MiB chunks, `1862` non-zero, `52` boot chunks)  
**Full Image SHA-256:** `7321ea53b91a9c396a8262a7015dd79479b120dcec0389166455813e7626c266`

---

## 1. Image Assembly & NOMMU Configuration

1. Reconstructed the 3.0 GiB `ubuntu-24.04-kde` ext4 image (`3072` chunks), resized to `3.5 GiB` (`3758096384` bytes, `917504` 4K blocks), and verified with `e2fsck -fy`.
2. Extracted all **276** official `riscv64` `.deb` packages (`epiphany-browser`, `libwebkitgtk-6.0-4`, `libjavascriptcoregtk-6.0-1`, `ca-certificates`, `curl`, `python3`, `fonts-dejavu-core`, `fonts-noto-core`, etc.).
3. Fixed `/lib/ld-linux-riscv64-lp64d.so.1` symlink to `/usr/lib/riscv64-linux-gnu/ld-linux-riscv64-lp64d.so.1` (because `/lib` is a real directory in the base image).
4. Installed `/usr/local/bin/epiphany-weblinux` with NOMMU-safe environment flags:
   - `GDK_BACKEND=wayland`, `WAYLAND_DISPLAY=wayland-0`, `XDG_RUNTIME_DIR=/tmp/runtime-root`
   - `JSC_useJIT=0` (disables JavaScriptCore JIT on NOMMU)
   - `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`
   - `WEBKIT_DISABLE_DMABUF_RENDERER=1`
   - `WEBKIT_DISABLE_COMPOSITING_MODE=1` (prevents `WebKitWebProcess` Mesa/EGL crash on `wlserver`)
   - `LIBGL_ALWAYS_SOFTWARE=1`, `GSK_RENDERER=cairo` (bypasses GTK4 `ngl`/`llvmpipe` shader compilation)
   - `NO_AT_BRIDGE=1`, `GTK_A11Y=none`
5. Installed shared `/usr/local/bin/browser` launcher and `/usr/share/applications/org.gnome.Epiphany.desktop`.
6. Generated `/etc/ssl/certs/ca-certificates.crt` (`180744` bytes) and compiled GSettings schemas.

---

## 2. Live Verification in Microsoft Edge

Verified via [`tests/test-phase8-epiphany.js`](file:///E:/Web-Linux/weblinux-local/tests/test-phase8-epiphany.js):

1. **Boot & Wayland Readiness:**
   - Booted to `shellReady: true`, `waylandActive: true` in `22.1s–29.5s` (`2048 MiB` RAM, `OPFS ext4: RW`, `Relay Active`).
2. **Guest Networking & TLS Verification:**
   - `DNS: 104.20.23.154` / `172.66.147.243`
   - `HTTPS_STATUS: 200 TITLE_OK: True` (`https://example.com`)
   - `RFC1918_BLOCK: OK URLError` (`http://192.168.1.1` blocked)
3. **Epiphany Multi-Process Execution:**
   - `/usr/bin/epiphany https://example.com` (`Web 46.5`) launched inside KDE Plasma 5.27 on Wayland (`1146x890` window, `https://example.com` in the address bar, taskbar icon, `Set as Default Browser?` modal).
   - `WebKitNetworkProcess` connected over HTTP/2 + TLS (`libsoup-http2-DEBUG: [RECV] [SETTINGS]`).
   - `WebKitWebProcess` spawned and ran concurrently (`979–1101 MiB` total guest RAM used out of `2009 MiB`, leaving `907–1029 MiB` available).
   - Profile database files created in `/root/.local/share/epiphany/`: `bookmarks.gvdb`, `cookies.sqlite`, `ephy-history.db` (`-shm`, `-wal`), `itp`, `mediakeys`, `storage`.
4. **Known Performance/Rendering Constraint:**
   - First-run `ephy-profile-migrator` (38 migrators) + `org.freedesktop.secrets` D-Bus timeout (~25s) + `WebKitWebProcess` startup under RISC-V NOMMU interpreter triggers Epiphany's 10-second `"Page Unresponsive"` dialog before `WebKitWebProcess` completes initial page paint.
   - Without `WEBKIT_DISABLE_COMPOSITING_MODE=1`, `WebKitWebProcess` GL/EGL initialization crashes/freezes the guest display after ~2m33s; with `WEBKIT_DISABLE_COMPOSITING_MODE=1` + `GSK_RENDERER=cairo`, the desktop and Epiphany UI remain stable.
