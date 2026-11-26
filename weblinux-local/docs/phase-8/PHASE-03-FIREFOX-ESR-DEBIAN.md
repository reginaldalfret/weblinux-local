# Phase 8 — Phase 3: Debian 13 Trixie + Firefox ESR (`firefox-esr`)

**Date:** 2026-11-25  
**Target Distribution:** Debian GNU/Linux 13 (Trixie) `riscv64`  
**Package:** `firefox-esr` `153.5.1esr-1~deb13u1` (124-package official Debian `riscv64` closure)  
**Manifest:** [`apps/web/public/manifests/debian-firefox.json`](file:///E:/Web-Linux/weblinux-local/apps/web/public/manifests/debian-firefox.json)  
**Disk Chunks:** `D:\weblinux-disks\debian-13-firefox\` (`8192` x 1 MiB chunks, `4209` non-zero, `64` boot chunks)  
**Full Image SHA-256:** `93c5032899e33396c0e97c4800a508177df281678a80b92fc365894f4b08cde0`

---

## 1. Image Assembly & Configuration

1. Reconstructed the 8 GiB Debian 13 `release` ext4 base image (`3914` non-zero chunks) in WSL2 (`Fedora-45`).
2. Extracted all **124** official `riscv64` `.deb` packages (`firefox-esr`, `libnss3`, `libnspr4`, `libgtk-3-0t64`, `ca-certificates`, `fonts-dejavu-core`, etc.) into the mounted ext4 rootfs.
3. Configured `/etc/firefox-esr/firefox-esr.js` for NOMMU execution:
   - Disabled SpiderMonkey JIT/Ion/Wasm JIT (`javascript.options.baselinejit`, `ion`, `blinterp`, `wasm_baselinejit`, `wasm_ionjit` = `false`).
   - Disabled content sandbox (`security.sandbox.content.level` = `0`) and forced software WebRender (`gfx.webrender.software` = `true`).
4. Installed `/usr/local/bin/firefox-esr-weblinux`, shared `/usr/local/bin/browser`, and `/usr/share/applications/firefox-esr.desktop`, plus `/etc/ssl/certs/ca-certificates.crt` (`224449` bytes) and `glib-compile-schemas`.
5. Ran `e2fsck -fy` (`149035/524288` files, `1057387/2097152` blocks) and sliced all `8192` chunks cleanly.

---

## 2. Live Execution & NOMMU Compatibility Findings

Tested in Microsoft Edge via [`tests/test-phase8-firefox.js`](file:///E:/Web-Linux/weblinux-local/tests/test-phase8-firefox.js) with `mem=2048M`:

1. **Image Boot & Preflight:**
   - Debian 13 + Firefox ESR booted to `shellReady: true`, `waylandActive: true` in `27.2s–39.1s`.
   - `/usr/bin/firefox-esr --version` returned `Mozilla Firefox 153.5.1esr` when sufficient contiguous memory existed prior to full Plasma saturation.
   - Wayland socket verified at `/tmp/runtime-root/wayland-0`.
2. **Wrapper `su` Finding:**
   - `/usr/local/bin/firefox-esr-weblinux` initially invoked `su -s /bin/bash browser`, which failed with `su: Authentication failure` under NOMMU PAM without `/etc/shadow` entries.
3. **NOMMU `libxul.so` Contiguous `mmap` Limitation (Critical Finding):**
   - `/usr/lib/firefox-esr/libxul.so` is **`153 MiB`** (`-rw-r--r-- 1 root root 153M`).
   - Under Linux `wasm64_nommu` without `CONFIG_COMPACTION` (`/proc/sys/vm/compact_memory: No such file or directory`), `dlopen("/usr/lib/firefox-esr/libxul.so")` requires a single contiguous physical allocation of `order 16` (`256 MiB`).
   - Once KDE Plasma 6 is running (`1310–1377 MiB` used out of `2009 MiB`, `583–703 MiB` free), `/proc/buddyinfo` showed:
     `Node 0, zone Normal ... 8 0 2 1 1 0 0 0 0` -> **`0` blocks of `order 15` (128 MiB) and `0` blocks of `order 16` (256 MiB)**.
   - Consequently, `firefox-esr` fails to load XPCOM:
     `XPCOMGlueLoad error for file /usr/lib/firefox-esr/libxul.so: failed to map segment from shared object / Couldn't load XPCOM.`
   - Even after `killall -9 plasmashell` (`1429 MiB` free), `buddyinfo` had `1` block of `order 15` (128 MiB) and `0` blocks of `order 16` (256 MiB).
4. **NOMMU `fork()` Limitation:**
   - When `libxul.so` did map (early in boot before full Plasma memory fragmentation), Gecko's child-process `fork()` hit:
     `rv: cannot copy the guest from the parent of a fork`
     because `/bin/rv` cannot duplicate a >150 MiB parent address space on `fork()`.

---

## 3. Conclusion for Debian 13

- **Firefox ESR `153.5.1esr`** is **architecturally incompatible with a `2048 MiB` NOMMU KDE Plasma 6 session** due to `libxul.so` (`153 MiB` contiguous `mmap` requirement exceeding available `order 16` buddy blocks) and `/bin/rv` `fork()` duplication limits.
- **Recommended Path:** WebKitGTK (`epiphany-browser`) uses smaller modular shared libraries and `posix_spawn()` (`vfork`+`exec`), avoiding both the `153 MiB` single-DSO contiguous allocation and heavy `fork()` duplication.
