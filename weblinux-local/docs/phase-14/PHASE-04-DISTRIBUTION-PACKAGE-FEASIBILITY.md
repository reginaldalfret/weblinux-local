# Phase 14.4 — Six-Distribution Package Feasibility Matrix

**Date:** 2026-11-27  
**Target Common Version:** Chromium `158.0.8127.88` (`0cefb18236a23db1ebb6b2bc040fbbaf8cbe759e`)

| Distribution | Native `riscv64` Repo Checked | Chromium `158.0.8127.88` Available? | Live Repo Finding | Package Signature | Status |
|---|---|---|---|---|---|
| **Debian 13 (Trixie)** | `deb.debian.org/debian/dists/trixie/main/binary-riscv64/Packages.xz` | **No** | `chromium` absent from `binary-riscv64` | APT signed | **BLOCKED** |
| **Ubuntu 24.04.5 (Noble)** | `ports.ubuntu.com/ubuntu-ports/dists/noble/universe/binary-riscv64/Packages.xz` | **No** | `chromium` / `chromium-browser` absent from `binary-riscv64` | APT signed | **BLOCKED** |
| **Arch Linux RISC-V** | `archriscv.felixc.at/repo/extra/os/riscv64/extra.db` | **No** | `chromium` absent from `extra.db` | Pacman `.sig` | **BLOCKED** |
| **openSUSE Tumbleweed** | `download.opensuse.org/ports/riscv/tumbleweed/repo/oss/riscv64/` | **No** | Only `chromium-155.0.8059.84-238.1.riscv64.rpm` (3 milestones behind) | RPM GPG signed | **BLOCKED** |
| **Fedora 45** | `riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/` | **No** | `chromium` absent; repo RPMs unsigned (`gpgcheck=1` enforced) | Unsigned upstream | **BLOCKED** |
| **Alpine 3.24.4** | `dl-cdn.alpinelinux.org/alpine/v3.24/community/riscv64/APKINDEX.tar.gz` | **No** | `chromium` absent from `v3.24/community/riscv64` | APK RSA signed | **BLOCKED** |
