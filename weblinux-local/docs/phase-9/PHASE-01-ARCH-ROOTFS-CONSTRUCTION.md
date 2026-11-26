# Phase 9 — Phase 1: Arch Linux RISC-V Rootfs Construction

**Date:** 2026-11-26  
**Build Script:** [`scripts/build-arch-kde-rootfs.sh`](file:///E:/Web-Linux/weblinux-local/scripts/build-arch-kde-rootfs.sh)  
**Bootstrap Image:** `archriscv-2026-08-27.tar.zst` (SHA-256: `a2045c8b62232db2f60d8e4db610dbb5d9e12856dab0ba08634ad3d7cb7ad498`)

---

## 1. Keyring & Full System Upgrade (`pacman -Syu`)

1. Bootstrapped into isolated WSL2 ext4 directory `/root/arch-test/rootfs` with `qemu-user-static-riscv` (`11.1.3-1`).
2. Initialized `pacman-key --init` and populated `/usr/share/pacman/keyrings/archlinux.gpg`.
3. Kept `SigLevel = Required DatabaseOptional` enabled (no `SigLevel = Never`).
4. Added `DisableSandbox` and commented `DownloadUser` in `/etc/pacman.conf` because Linux `6.6.0-wasm64_nommu` (and WSL2 chroot) lacks Landlock sandboxing for `alpm`.
5. Added `https://archriscv.felixc.at/repo/$repo` as fallback mirror alongside `https://riscv.mirror.pkgbuild.com/repo/$repo`.
6. Executed `pacman -Syu --noconfirm` upgrading **64** base packages (`89.20 MiB` download, `407.97 MiB` installed), including `glibc 2.44+r78+gfcfb867c58ab-1`, `bash 5.3.20-1`, `pacman 7.1.0.r9.g54d9411-4.1`, `dbus 1.16.4-1`, and `openssl 4.1.0-1`.

---

## 2. Security & System Configuration

- Locked the default `root/archriscv` password (`passwd -l root`).
- Configured `/etc/hostname` (`archriscv`), `/etc/hosts`, `/etc/locale.conf` (`LANG=C.UTF-8`), and `/etc/resolv.conf` (`nameserver 10.0.5.1`).
- Disabled non-functional setuid `org.freedesktop.UDisks2.service` D-Bus activation inside the NOMMU chroot.
- Preserved `/var/cache/pacman/pkg/` signed package archives externally in `D:\weblinux-build\arch-pkg-cache\`.
