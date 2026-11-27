# Phase 13.0 — Baseline Inspection (Alpine Linux 3.24.4 RISC-V + KDE Plasma 6)

**Date:** 2026-11-27  
**Branch:** `feature/runtime-foundations`  
**Verified Starting HEAD:** `13d692e199d12eea961818296102b7a019d60131` (`origin/feature/runtime-foundations`)

---

## 1. Repository, Storage, and Distribution Lineup

- **Git state:** `feature/runtime-foundations` tracking `origin/feature/runtime-foundations` at `13d692e`. Pre-existing working-tree modifications in `tests/screenshots/phase6-kde/*`, `tests/screenshots/phase7-gpu/*`, and `../.phase9-build/` are preserved untouched.
- **Storage capacity:** `D:` has `35.92 GiB` free; `E:` has `67.69 GiB` free.
- **Existing 5-distribution lineup (preserved untouched):**
  1. Debian 13 KDE (`debian-13-firefox`)
  2. Ubuntu 24.04.5 KDE (`ubuntu-24.04-kde-epiphany`)
  3. Arch Linux KDE (`arch-kde`)
  4. openSUSE Tumbleweed KDE (`opensuse-tumbleweed-kde`)
  5. Fedora 45 KDE (`fedora-kde`)

---

## 2. WebLinux Runtime & Packaging Conventions

- **Kernel & Initramfs:** Linux `6.6.0` WebAssembly64 NOMMU (`/bin/rv` userspace execution, BusyBox `/init`, `initramfs-wasm64_nommu.cpio.gz`, `kernelSha256: 31287a56f4d80f5767dc2e07abf1986a3722a6fb6f1bef72d714d189a2e65c49`).
- **Storage & Chunking (`scripts/package-*-image.sh`):**
  - ext4 root filesystem (`/dev/wda`) + persistent ext4 home filesystem (`/dev/wdb`), OPFS-backed (`root-alpine-kde`, `home-alpine-kde`).
  - `1 MiB` (`1048576` bytes) chunks with 6-digit decimal filenames (`000000`, `000001`, ...), `manifest.json` + `integrity.json` with round-trip SHA-256 verification.
- **Display & Graphics:**
  - `wlserver` Wayland compositor (`WAYLAND_DISPLAY=wayland-0`, `XDG_RUNTIME_DIR=/tmp/runtime-root`), `QT_QPA_PLATFORM=wayland`, `gpuserver` (`rvgpu-0`), with software QML fallback (`QT_QUICK_BACKEND=software QMLSCENE_DEVICE=softwarecontext LIBGL_ALWAYS_SOFTWARE=1`).
- **Networking:** `scripts/guest-net-relay.js` on `ws://127.0.0.1:8081` with RFC1918/loopback/link-local/multicast blocking.
- **Alpine Target:** Alpine Linux `3.24.4` (`v3.24/main` + `v3.24/community`), `riscv64`, musl libc, APK, KDE Plasma 6.
