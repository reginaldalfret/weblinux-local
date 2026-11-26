# Phase 9 — Phase 3: Arch Linux Disk & Initramfs Packaging

**Date:** 2026-11-26  
**Packaging Script:** [`scripts/package-arch-kde-image.sh`](file:///E:/Web-Linux/weblinux-local/scripts/package-arch-kde-image.sh)  
**Initramfs Script:** [`scripts/update-initramfs-arch.sh`](file:///E:/Web-Linux/weblinux-local/scripts/update-initramfs-arch.sh)

---

## 1. Root Filesystem Image & Chunks

- **Image Size:** `5,368,709,120` bytes (`5.0 GiB`, `1,310,720` x 4K blocks, `3.6 GiB` used, `~1.4 GiB` free).
- **Filesystem:** `ext4` (`-L arch-kde -m 1 -O ^metadata_csum_seed`), UUID `e1c0a792-3418-402e-b56b-ebe690e1b8e2`.
- **`e2fsck -fy` Result:** Clean (`156052/327680` files, `0.1%` non-contiguous, `960793/1310720` blocks).
- **Chunk Output (`D:\weblinux-disks\arch-kde\`):**
  - Total 1 MiB chunks: `5120`
  - Non-zero chunks: `3644`
  - Boot prefetch chunks: `64`
  - Full-image SHA-256: `7b17baecf646ba347cf2a83d2f15f9dcee49326a24a85798b7ffa47ec2ac0aed`
- **Manifest:** [`apps/web/public/manifests/arch-kde.json`](file:///E:/Web-Linux/weblinux-local/apps/web/public/manifests/arch-kde.json) (`rootDiskId: root-arch-kde`, `homeDiskId: home-arch-kde`).

---

## 2. Initramfs Integration (`initramfs-wasm64_nommu.cpio.gz`)

- Added `/bin/arch-root` (preserving BusyBox `/bin/arch`) and `/bin/arch-kde`.
- Updated `/init` to mount `/dev/wda` on `/arch` and `/dev/wdb` on `/arch/root` when `distro=arch*`.
- Updated compressed & uncompressed `initrd` sizes and SHA-256 hashes across active manifests and `WasmLinuxAdapter.ts`:
  - Compressed size: `15,060,899` bytes, SHA-256: `e3738b20d9899773cc1024b343e53760c372683a19947b92380d17d5751ce139`
  - Uncompressed size: `36,648,960` bytes, SHA-256: `fe6ce11c8b1cf61fdbe43e399ec005be665ce4b40fc9c8fa35465aae1c7a477a`
