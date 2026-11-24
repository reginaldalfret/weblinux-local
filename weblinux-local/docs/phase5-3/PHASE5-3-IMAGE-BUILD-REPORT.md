# WEBLINUX LOCAL — PHASE 5.3
# ROOTFS IMAGE BUILD & PACKAGING SPECIFICATION

**Document ID:** `PHASE5-3-BUILD-001`  
**Target:** Debian GNU/Linux 13 (Trixie) RISC-V 64-bit NOMMU  
**Block Chunking:** 1 MiB chunked sparse ext4 filesystem  
**Date:** 2026-11-24  

---

## 1. Image Build & Manifest Generation Architecture

The WebLinux Local storage pipeline requires rootfs images to be formatted as sparse ext4 filesystems partitioned into 1 MiB (`1048576` bytes) binary chunks.

### 1.1 Chunk Manifest Structure (`manifest.json`)
```json
{
  "size": 8589934592,
  "piece": 1048576,
  "id": "21dd6321337e178c4ac19c27d790403a",
  "present": "ffffffffffffffffffffffffffffffff8ffffffff..."
}
```
- `size`: Total virtual block device size in bytes (8 GiB).
- `piece`: Chunk size (1 MiB).
- `id`: Unique cryptographic disk image fingerprint.
- `present`: Hexadecimal bitmask denoting which 1 MiB chunks contain non-zero data blocks. Zero chunks are synthesized in memory without network requests.

---

## 2. Desktop-Specific Manifest Inventory

1. **`debian-13-kde-plasma6`:**
   - Manifest: `/manifests/debian-13-kde-plasma6.json`
   - Image URI: `/disk/release/`
   - Status: **Validated & Operational**.
2. **`debian-13-gnome-48`:**
   - Manifest: `/manifests/debian-13-gnome-48.json`
   - Image URI: `/disk/gnome/`
   - Status: **Blocked (Unreleased)**.
3. **`debian-13-xfce-420`:**
   - Manifest: `/manifests/debian-13-xfce-420.json`
   - Image URI: `/disk/xfce/`
   - Status: **Blocked (Unreleased)**.
