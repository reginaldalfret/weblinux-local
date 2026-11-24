# WEBLINUX LOCAL — PHASE 6.2.1
# DISK FORMAT SPECIFICATION & PACKAGING PIPELINE ANALYSIS

**Document ID:** `PHASE6-2-DISK-FORMAT-001`  
**Workspace:** `E:\Web-Linux\weblinux-local`  
**Branch:** `feature/ubuntu-24.04-noble`  
**Target:** Ubuntu 24.04.5 LTS (Noble Numbat) riscv64  
**Date:** 2026-11-24  
**Status:** VALIDATED AGAINST RUNTIME SOURCE CODE  

---

## 1. Executive Summary

This engineering analysis documents the exact virtual block-device architecture, ext4 filesystem format, chunk slicing specification, and metadata contracts used by WebLinux Local. To guarantee 100% interoperability with the existing WebAssembly kernel (`vmlinux-wasm64_nommu.wasm`) and block device worker ([`disk-worker.js`](file:///E:/Web-Linux/weblinux-local/apps/web/public/disk-worker.js)), Ubuntu 24.04 LTS (Noble Numbat) will adopt this exact specification without introducing alternative or unverified disk-loading mechanisms.

---

## 2. Block Device & Filesystem Specification

### 2.1 Virtual Block Devices
WebLinux Local provisions two virtual virtio/wasm block devices inside the guest kernel:
1. `/dev/wda` (Major 254, Minor 0): Root filesystem (`ext4`, read-only image source with copy-on-write overlay in OPFS).
2. `/dev/wdb` (Major 254, Minor 16): Persistent home storage (`ext4`, read-write in OPFS).

### 2.2 Ext4 Filesystem Parameters (Extracted from Debian Reference Baseline)
Inspection of the existing known-good reference image (`release_000000` superblock at offset `0x400` / 1024 bytes) establishes the exact filesystem geometry:

| Filesystem Parameter | Debian Baseline Value | Ubuntu 24.04 Specification | Technical Rationale |
|---|---|---|---|
| **Magic Signature** | `0xEF53` | `0xEF53` | Standard ext4 superblock magic |
| **Filesystem Type** | `ext4` | `ext4` | Native in-kernel Linux ext4 driver (`fs/ext4`) |
| **Block Size** | `4096 bytes` (`s_log_block_size = 2`) | `4096 bytes` | Standard Linux 4 KiB paging/buffer alignment |
| **Inode Ratio / Size** | 256 bytes per inode | 256 bytes per inode | Supports standard extended attributes and timestamps |
| **Feature Compat** | `0x3c` | `0x3c` | `HAS_JOURNAL`, `EXT_ATTR`, `RESIZE_INODE`, `DIR_INDEX` |
| **Feature Incompat** | `0x2c2` | `0x2c2` | `FILETYPE`, `EXTENTS`, `FLEX_BG` |
| **Feature RO Compat** | `0x46b` | `0x46b` | `SPARSE_SUPER`, `LARGE_FILE`, `HUGE_FILE`, `DIR_NLINK`, `EXTRA_ISIZE` |
| **Target Disk Capacity** | 8 GiB (`8589934592` bytes) | 2 GiB (`2147483648` bytes) | Sized appropriately for Ubuntu base (extracted payload ~92 MiB) with ample package margin |

---

## 3. Chunk Slicing & Naming Specification

[`disk-worker.js`](file:///E:/Web-Linux/weblinux-local/apps/web/public/disk-worker.js) loads disk images on demand using a deterministic 1 MiB chunk contract:

### 3.1 Chunk Geometry
- **Chunk Size (`piece`):** Exactly `1,048,576 bytes` (1 MiB / `0x100000` bytes).
- **Chunk Numbering:** 0-indexed contiguous integers (`0`, `1`, `2`, ... `N-1`).
- **Total Chunks ($N$):** $\lceil \text{Disk Size} / \text{Piece Size} \rceil$. For a 2 GiB image: $2,147,483,648 / 1,048,576 = 2,048$ chunks.
- **Chunk Naming Convention:** 6-digit zero-padded decimal string:
  ```
  000000
  000001
  000002
  ...
  002047
  ```
  Verified against [`disk-worker.js`](file:///E:/Web-Linux/weblinux-local/apps/web/public/disk-worker.js) line 445:
  ```javascript
  const url = base + String(piece).padStart(6, "0");
  ```

---

## 4. Manifest Metadata Schema (`manifest.json`)

When mounting `/dev/wda`, [`disk-worker.js`](file:///E:/Web-Linux/weblinux-local/apps/web/public/disk-worker.js) fetches `base + "manifest.json"` to validate chunk sizes and cryptographic hashes:

```json
{
  "size": 2147483648,
  "piece": 1048576,
  "id": "<unique-hex-build-id>",
  "hashes": [
    "<sha256-chunk-0>",
    "<sha256-chunk-1>",
    "<sha256-chunk-2>",
    ...
  ],
  "boot": [
    0,
    1,
    ...
  ]
}
```

### 4.1 Schema Fields Definition:
1. `size` (integer): Total virtual disk capacity in bytes.
2. `piece` (integer): Fixed chunk size in bytes (`1048576`).
3. `id` (string): Unique content identifier or hash of the image.
4. `hashes` (array of strings): Array of 64-character lowercase SHA-256 hexadecimal digests, indexed by chunk number (`hashes[piece]`).
5. `boot` (array of integers): Ordered list of chunk indices touched during initial cold boot. Used by `disk-worker.js` fetcher thread to prefetch boot-critical blocks asynchronously.

---

## 5. Asset Delivery & Web Server Integration

1. **Development Server ([`vite.config.ts`](file:///E:/Web-Linux/weblinux-local/apps/web/vite.config.ts)):**
   - The Vite development server provides a disk proxy middleware for `/disk/*`.
   - Local chunk files placed in `apps/web/public/disk/ubuntu-24.04/` or `.disk-cache/ubuntu-24.04_*` are served with:
     - `Content-Type: application/octet-stream` (or `application/json` for manifest).
     - `Content-Length: <size>`.
     - `Cache-Control: public, max-age=31536000, immutable`.
2. **Production Build:**
   - Static assets placed in `apps/web/public/disk/ubuntu-24.04/` are copied directly to `dist/disk/ubuntu-24.04/` during `npm run build`.

---

## 6. Verification Checklist for Phase 6.2 Construction

- [x] Disk format confirmed as standard `ext4`.
- [x] Superblock block size confirmed at 4096 bytes.
- [x] Chunk size confirmed at 1,048,576 bytes (1 MiB).
- [x] Chunk filename format confirmed as 6-digit zero-padded decimal (`000000`).
- [x] Manifest schema confirmed with `size`, `piece`, `id`, `hashes`, and `boot`.
- [x] Byte-for-byte reconstruction requirement established.
