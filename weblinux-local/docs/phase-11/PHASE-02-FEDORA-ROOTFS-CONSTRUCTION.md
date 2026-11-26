# Phase 11 — Fedora 45 Rootfs Construction

## 1. Base Image Extraction (`scripts/fetch-fedora-riscv-rootfs.sh`)

- **Base Artifact:** `Fedora-Container-Base-Generic-45-20261022.0.riscv64.oci.tar.xz` (`74.54 MiB`, `SHA-256: bfc2ad635a352818a8d250fde1175193f76a96ace071b569f67abd3124020f8e`)
- Extracted OCI layer `90c9bb9b37e84bac293628d698e9e3cac95da0a930e8c3f45cfe24c909d2479a` (`204 MiB` base rootfs).

## 2. KDE Plasma 6 Installation (`scripts/build-fedora-kde-rootfs.sh`)

- Installed `568` additional RPMs (`plasma-workspace 6.7.4-1.fc45`, `plasma-desktop 6.7.4-1.fc45`, `kwin 6.7.4-2.fc45`, `dolphin 26.08.0-1.fc45`, `konsole 26.08.0-1.fc45`, `qt6-qtwayland 6.11.1-2.fc45`, `mesa-dri-drivers 26.2.0-1.fc45`, `mesa-demos 9.0.0-12.fc45`, `dbus-daemon 1.16.2-6.fc45`, `breeze-icon-theme 6.29.0-1.fc45`, `plasma-breeze 6.7.4-2.fc45`, `dejavu-sans-fonts`) into `/root/fedora-build/rootfs` via `dnf5 --installroot --forcearch=riscv64 --releasever=45`.
- Preserved `/etc/os-release`, RPM 6.1.0 database (`717` total packages in `docs/phase-11/fedora-kde-packages.lock`), and `/usr/share/dnf5/repos.d/*.repo` (copied into `/etc/yum.repos.d/`).
- Locked `root` password (`passwd -l root`) and generated D-Bus `/etc/machine-id` and `/var/lib/dbus/machine-id`.
- Final rootfs size: `1.9 GiB` (`1,813,869,314` bytes).
