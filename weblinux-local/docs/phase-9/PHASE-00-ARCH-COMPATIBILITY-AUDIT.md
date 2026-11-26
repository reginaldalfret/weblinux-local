# Phase 9 — Phase 0: Arch Linux RISC-V Compatibility & Feasibility Audit

**Date:** 2026-11-26  
**Branch:** `feature/runtime-foundations`  
**Target:** Arch Linux RISC-V (`RV64GC` / `LP64D`) + KDE Plasma 6 (`6.8.3`)

---

## 1. Source Provenance & Integrity

- **Community Port:** `https://archriscv.felixc.at/` (not an official upstream Arch Linux architecture; community-maintained RISC-V port).
- **Bootstrap Rootfs:** `https://archriscv.felixc.at/images/archriscv-2026-08-27.tar.zst`
  - Size: `164 MiB` (`171.8 MB` decimal)
  - SHA-256: `a2045c8b62232db2f60d8e4db610dbb5d9e12856dab0ba08634ad3d7cb7ad498`
  - **Limitation:** The `/images/` directory does not publish a detached `.sig` or `.sha256` file for `archriscv-2026-08-27.tar.zst`. Authenticity of the userspace is therefore enforced by initializing `pacman-key` and upgrading/installing all packages with `SigLevel = Required DatabaseOptional` against signed repository packages (`.pkg.tar.zst.sig`).
- **Repositories:** `https://riscv.mirror.pkgbuild.com/repo/$repo` (`[core]` and `[extra]`, `pacman v7.1.0`, `libalpm v16.0.1`).

---

## 2. ELF Architecture & ABI Verification (`readelf -h` / `readelf -A`)

Inspected `/usr/bin/bash`, `/usr/bin/pacman`, `/usr/bin/uname`, and `/usr/lib/ld-linux-riscv64-lp64d.so.1`:
- **Class:** `ELF64`
- **Machine:** `RISC-V`
- **Flags:** `0x5, RVC, double-float ABI` (`LP64D`)
- **`Tag_RISCV_arch`:** `rv64i2p1_m2p0_a2p1_f2p2_d2p2_c2p0_zicsr2p0_zifencei2p0_zmmul1p0_zaamo1p0_zalrsc1p0_zca1p0_zcd1p0` (pure **RV64GC**, no vector `V` or unsupported extensions).
- **Merged `/usr`:** `/bin -> usr/bin`, `/lib -> usr/lib`, `/sbin -> usr/bin`. `/lib/ld-linux-riscv64-lp64d.so.1` resolves directly to `/usr/lib/ld-linux-riscv64-lp64d.so.1` (`164,608` bytes).

---

## 3. Initramfs & Disk Isolation Plan

- **Initramfs (`initramfs-wasm64_nommu.cpio.gz`):**
  - Currently contains `/bin/busybox`, `/bin/rv`, `/bin/debian`, `/bin/ubuntu`, `/bin/ubuntu-kde`, and `/bin/arch -> busybox`.
  - **Important naming detail:** Because `/bin/arch` is BusyBox's `arch` applet symlink, the Arch chroot/session supervisors will be `/bin/arch-root` and `/bin/arch-kde` (invoked when `distro=arch-kde`), leaving `/bin/arch`, `/bin/debian`, `/bin/ubuntu`, and `/bin/ubuntu-kde` untouched.
- **Independent OPFS Disk Identities:**
  - `root-arch-kde` (`/dev/wda`, served from `D:\weblinux-disks\arch-kde\` via `/disk/arch-kde/`)
  - `home-arch-kde` (`/dev/wdb`, isolated from `home-debian` and `home-ubuntu`)
