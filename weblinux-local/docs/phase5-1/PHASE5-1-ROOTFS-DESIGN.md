# WebLinux Local — Phase 5.1: Desktop Rootfs Architecture & Disk Isolation Design

**Date:** 2026-11-24  
**Architecture:** RISC-V 64-bit NOMMU (`linux-wasm64_nommu-6.6.0`)  
**Storage Engine:** Origin Private File System (OPFS) Sparse Block Worker  

---

## 1. Storage Architecture Overview

WebLinux Local operates virtual block devices backed by Web Workers accessing browser OPFS via `FileSystemSyncAccessHandle`. Sector reads and writes occur directly between the WebAssembly linear memory (`SharedArrayBuffer`) and chunked sparse virtual disk containers on the host browser.

```text
Host Browser (Origin Private File System)
   ├── root-debian-kde-plasma (8 GiB ext4 sparse container)  --> /dev/wda (/debian)
   ├── root-debian-gnome      (8 GiB ext4 sparse container)  --> /dev/wda (/debian)
   ├── root-debian-xfce       (8 GiB ext4 sparse container)  --> /dev/wda (/debian)
   └── home-debian            (16 GiB ext4 persistent disk)  --> /dev/wdb (/debian/root)
```

---

## 2. Root Disk Identity & Cache Isolation Contract

To prevent cache corruption between differing desktop environments, WebLinux Local implements deterministic, profile-specific root disk identities:

```typescript
const rootDiskId = `root-${options.manifest.id}-${options.desktop}`;
const homeDiskId = `home-${options.manifest.id}`;

const diskConfig = [
  {
    worker: `/disk-worker.js?v=${Date.now()}`,
    url: options.manifest.imageSource.baseUri || '/disk/release/',
    name: rootDiskId,
    reset: !!options.freshRootDisk,
  },
  {
    worker: `/disk-worker.js?v=${Date.now()}`,
    url: `/disk/home/`,
    keep: true,
    name: homeDiskId,
    reset: !!options.freshHomeDisk,
  }
];
```

### Identity Specification:
- **KDE Plasma 6 Root:** `root-debian-kde-plasma`
- **GNOME 48 Root:** `root-debian-gnome`
- **XFCE 4.20 Root:** `root-debian-xfce`
- **Persistent User Home:** `home-debian`

### Benefits:
1. **Zero Collision Risk:** Root filesystem modifications (e.g. package installations, `/etc` configuration changes) made in one desktop do not pollute or corrupt another desktop environment.
2. **Deterministic Chunk Caching:** The OPFS block worker indexes 1 MiB chunks per discrete disk name. Switching profiles swaps the underlying virtual block device cleanly.

---

## 3. Persistent User Home Sharing Across Desktop Profiles

The secondary block device `/dev/wdb` (`home-debian`) is preserved across all desktop environments:

```text
/dev/wdb (/debian/root)
  ├── .config/
  │    ├── kdeglobals        <-- KDE Plasma configuration
  │    ├── dconf/            <-- GNOME dconf database
  │    └── xfce4/            <-- XFCE panel and desktop configuration
  ├── Documents/             <-- Shared user files
  ├── Downloads/             <-- Shared downloads
  ├── Projects/              <-- Development code
  └── WebLinux-Phase5-Tests/  <-- Acceptance persistence directories
```

All desktop environments read from and write to the same `/root` filesystem without clobbering each other's session configuration because standard Freedesktop / XDG specifications namespace configuration under distinct subdirectories in `.config/`.

---

## 4. Reproducible Image Generation Pipeline

To produce genuine GNOME 48 and XFCE 4.20 rootfs images for RISC-V 64-bit NOMMU:

```bash
#!/bin/bash
# tools/build-desktop-image.sh <desktop: kde|gnome|xfce>
set -e

DESKTOP=$1
ROOTFS_DIR="/tmp/rootfs-${DESKTOP}"
IMAGE_FILE="debian-13-${DESKTOP}-riscv64.ext4"

echo "=== Building Debian 13 ${DESKTOP} Image for riscv64 ==="

# 1. Debootstrap Debian Trixie base
debootstrap --arch=riscv64 --foreign trixie "${ROOTFS_DIR}" http://deb.debian.org/debian

# 2. Complete stage 2 chroot configuration via qemu-riscv64-static
chroot "${ROOTFS_DIR}" /debootstrap/debootstrap --second-stage

# 3. Install desktop package sets
case "${DESKTOP}" in
  gnome)
    chroot "${ROOTFS_DIR}" apt-get install -y --no-install-recommends \
      gnome-shell mutter nautilus dbus-x11 gsettings-desktop-schemas
    ;;
  xfce)
    chroot "${ROOTFS_DIR}" apt-get install -y --no-install-recommends \
      xfce4-session xfce4-panel xfdesktop4 thunar xfce4-terminal labwc
    ;;
  kde)
    chroot "${ROOTFS_DIR}" apt-get install -y --no-install-recommends \
      plasma-desktop kwin-wayland konsole dolphin
    ;;
esac

# 4. Generate sparse 8 GiB ext4 disk image
truncate -s 8589934592 "${IMAGE_FILE}"
mkfs.ext4 -F -L "Debian-${DESKTOP}" "${IMAGE_FILE}"
mount -o loop "${IMAGE_FILE}" /mnt/target
cp -a "${ROOTFS_DIR}/"* /mnt/target/
umount /mnt/target

# 5. Chunk image into 1 MiB slices for WebAssembly OPFS sparse worker
python3 tools/split-disk.py "${IMAGE_FILE}" --chunk-size 1048576 --output "public/disk/${DESKTOP}/"
```

The split chunks and manifest digests are then published to the local web server under `/disk/<desktop>/manifest.json`.
