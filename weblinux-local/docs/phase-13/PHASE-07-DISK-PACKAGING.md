# Phase 13.7 — Alpine ext4 Disk & Chunk Packaging

**Date:** 2026-11-27  
**Script:** `scripts/package-alpine-kde-image.sh`  
**Chunk Directory:** `D:\weblinux-disks\alpine-kde\`

---

## 1. Image & Chunk Integrity

- **Image Size:** `3,154,116,608` bytes (`3,008 MiB`, `ext4`, `-O ^metadata_csum_seed`, label `alpine-kde`)
- **Filesystem UUID:** `f6b9672a-ebb9-4c30-a354-65e080783f9b`
- **`e2fsck -fy`:** Clean (`64280/192768 files (0.2% non-contiguous), 417001/770048 blocks`)
- **Chunks:** `3008` x `1 MiB` (`1048576` bytes), `1538` non-zero, `64` boot chunks (`000000`–`003007`)
- **Full Image SHA-256:** `5067754980014f1250493043183e96decbddcdc41c993dff481091ff82bbbfa1`
- **Round-trip Chunk Reconstruction:** `RECONSTRUCT_OK=True`
- **OPFS Identities:** `root-alpine-kde` (`/dev/wda` -> `/alpine`), `home-alpine-kde` (`/dev/wdb` -> `/alpine/root`).
