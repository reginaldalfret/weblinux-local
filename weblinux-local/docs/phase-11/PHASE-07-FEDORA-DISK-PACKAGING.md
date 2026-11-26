# Phase 11 — Fedora 45 Ext4 Disk Packaging

## 1. Disk Sizing & Integrity (`scripts/package-fedora-kde-image.sh`)

- **Rootfs Used:** `1,813,869,314` bytes (`~1.69 GiB`)
- **Allocated Ext4 Image:** `3,489,660,928` bytes (`3,328 MiB`, `851,968` 4 KiB blocks, `212,992` inodes, label `fedora-kde`, `-O ^metadata_csum_seed`)
- **Filesystem UUID:** `5426ccde-a921-48ad-bb5d-e96b5126ae63`
- **`e2fsck -fy` Result:** Clean (`94,427 / 212,992` files, `516,525 / 851,968` blocks)

## 2. Chunk Slicing & Reconstruction

- **Chunk Naming:** 6-digit decimal (`000000`..`003327`), `1 MiB` (`1,048,576` bytes) per chunk
- **Total Chunks:** `3,328` (`1,927` non-zero chunks stored in `D:\weblinux-disks\fedora-kde\`, `64` boot chunks)
- **Full Image SHA-256:** `41ce9df26a9a1137ed159e78bae59b6ee39b05d6d462383ce74d61b426cb2bbc`
- **Round-Trip Reconstruction:** `RECONSTRUCT_OK=True`
- **OPFS Identities:** `root-fedora-kde` (`/dev/wda`) and `home-fedora-kde` (`/dev/wdb`)
