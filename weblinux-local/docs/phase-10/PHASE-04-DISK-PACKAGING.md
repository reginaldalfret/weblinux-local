# Phase 10 — Ext4 Disk Packaging & Integrity

## 1. Disk Sizing & Formatting (`scripts/package-opensuse-kde-image.sh`)

- **Extracted Rootfs Size:** `4.1 GiB`
- **Allocated Ext4 Image:** `5.6 GiB` (`5,905,580,032` bytes, `1,441,792` 4 KiB blocks, `360,448` inodes, label `opensuse-kde`, `-O ^metadata_csum_seed`)
- **Filesystem UUID:** `b5b43e7b-73c3-43e0-95bd-e6149ace6cc3`
- **`e2fsck -fy` Result:** Clean (`108,563 / 360,448` files, `1,085,900 / 1,441,792` blocks)

## 2. Chunk Slicing & Round-Trip Verification

- **Chunk Format:** 6-digit decimal (`000000`..`005631`), `1 MiB` (`1,048,576` bytes) per chunk, matching `disk-worker.js`
- **Total Chunks:** `5,632` (`4,114` non-zero chunks stored in `D:\weblinux-disks\opensuse-tumbleweed-kde\`, `64` boot chunks)
- **Full Image SHA-256:** `63d9098cb1914468c92cf29cb3f6572e36efa92949aafd84d78f4da48669b7b4`
- **Round-Trip Reconstruction Check:** `RECONSTRUCT_OK=True` (byte-for-byte SHA-256 match)
- **OPFS Identities:** `root-opensuse-tumbleweed-kde` (`/dev/wda`) and `home-opensuse-tumbleweed-kde` (`/dev/wdb`)
