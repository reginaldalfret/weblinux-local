# Phase 13.5 — Reproducible Alpine KDE Rootfs Construction

**Date:** 2026-11-27  
**Script:** `scripts/build-alpine-kde-rootfs.sh`  
**Package Lock:** `docs/phase-13/alpine-kde-packages.lock` (`594` packages, `1399.4 MiB` APK / `1.5G` rootfs)

---

## 1. Construction Summary

- Started from verified `alpine-minirootfs-3.24.4-riscv64.tar.gz` (`SHA-256: 010683db6c73b3ad1c334fc8f93f64ae748ef67ae6d69e964929aeaf8517bff3`).
- Configured `/etc/apk/repositories` with only `v3.24/main` and `v3.24/community`.
- Installed `594` signed `riscv64` / `noarch` APK packages including `plasma-desktop-6.6.6-r0`, `plasma-workspace-6.6.6-r0`, `kwin-6.6.6-r0`, `dolphin-26.04.2-r0`, `konsole-26.04.2-r0`, `qt6-qtbase-6.11.1-r0`, `qt6-qtwayland-6.11.1-r0`, `mesa-dri-gallium-26.1.6-r0`, `mesa-demos-9.0.0-r6`, `dbus-1.16.2-r2`, and `font-dejavu-2.37-r6`.
- Locked `root` (`passwd -l root`), generated `/etc/machine-id` and `/var/lib/dbus/machine-id` via `dbus-uuidgen`, and cleaned `/var/cache/apk/*`.
- **OpenRC:** OpenRC service booting is intentionally replaced by WebLinux BusyBox `/init` and `/usr/local/bin/alpine-kde-session`, which manage D-Bus, `wlserver`, `rvgpu`, and `plasmashell` directly.
