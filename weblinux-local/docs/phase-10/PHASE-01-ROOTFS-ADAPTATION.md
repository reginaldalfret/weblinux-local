# Phase 10 — Rootfs Adaptation to WebLinux

## 1. Authentic Userspace Preservation

Adapted `openSUSE-Tumbleweed-RISC-V-KDE.riscv64-rootfs.riscv64-2026.07.14-Snapshot20261106.tar.xz` (`4.1 GiB` extracted, `1697` RPM packages) via `scripts/adapt-opensuse-kde-rootfs.sh`:

- Preserved the authentic openSUSE RPM 4.20.1 database, Zypper 1.14.102 repository configuration, GPG keys, glibc `2.44-3.1`, Mesa `26.2.5`, Qt `6.12.0`, and KDE Plasma `6.8.2` packages.
- Installed `dolphin-26.08.3-1.1.riscv64` (+ 5 dependencies), `dbus-1-daemon-1.14.10-5.1.riscv64`, and `Mesa-demo-egl-9.0.0-7.1.riscv64` from GPG-signed `openSUSE-Tumbleweed-Oss` (never `--no-gpg-checks`).
- Locked the `root` password (`passwd -l root`) so no default password remains active.
- Generated 32-byte D-Bus `/etc/machine-id` and `/var/lib/dbus/machine-id` via `dbus-uuidgen`.

## 2. Initramfs & NOMMU Supervisor (`scripts/update-initramfs-opensuse.sh`)

- Added `/bin/opensuse-root` and `/bin/opensuse-kde` to `apps/web/public/runtime/initramfs-wasm64_nommu.cpio.gz`.
- Mounted `/opensuse/proc`, `/opensuse/sys`, `/opensuse/dev`, `/opensuse/dev/pts`, `/opensuse/run` (tmpfs), `/opensuse/tmp` (tmpfs), and bind-mounted `/usr/lib/{hostnode,wlserver,rvgpu,hostopen}` into `/opensuse/run/*`.
- Patched `/init` for `distro=opensuse*` (`mount -t ext4 -o noatime /dev/wda /opensuse`, `target_root="/opensuse/root"`, `/bin/opensuse-root true`).
