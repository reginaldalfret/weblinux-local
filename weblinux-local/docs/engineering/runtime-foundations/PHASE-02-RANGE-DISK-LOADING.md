# PHASE 02 — HTTP Range-Based Virtual Disk Loading

**Status:** VERIFIED & PASSED  
**Branch:** `feature/runtime-foundations`

---

## 1. Architecture & Implementation
1. **`VirtualBlockSource` (`runtime/disk/VirtualBlockSource.ts`):**
   - Unified `read(offset, length)`, `size()`, `verify()`, `close()`, `getStats()` interface.
   - `ChunkBlockSource`: Existing 1 MiB chunk loader with bounded LRU cache (<= 32 blocks) and in-flight deduplication.
   - `RangeBlockSource`: Probes with real 512-byte `Range: bytes=0-511` (`206 Partial Content` + `Content-Range` + `ETag`), enforces `maxConcurrency <= 4`, validates `Content-Range` and `ETag` on every block, and falls back automatically to `ChunkBlockSource` on `200 OK` or `416`.
2. **Consolidated Artifact (`scripts/build-ubuntu-range-image.js`):**
   - Assembled `apps/web/public/disk/ubuntu-24.04/rootfs.img` (2,147,483,648 bytes) from the 2,048 verified chunks.
   - Byte-for-byte SHA-256 verified: `5857dce5f4bcee138863b2cb5932c6a37ef15ec971ddf4cfc66167668a820a09`.
   - Retained all 2,048 chunk files and `boot` prefetch metadata; added `rangeImage` to `apps/web/public/disk/ubuntu-24.04/manifest.json`.
3. **Vite Dev Server & Worker (`vite.config.ts`, `disk-worker.js`):**
   - Updated `vite.config.ts` local `/disk/` middleware to use `fs.statSync` + `fs.createReadStream({ start, end })` for `206 Partial Content` streaming (fixing `ERR_FS_FILE_TOO_LARGE` on >2 GiB files).
   - Integrated `probe_range_source()` and `get_range()` into `disk-worker.js` with automatic fallback to chunk fetching.

---

## 2. Benchmark Results (Microsoft Edge, Ubuntu 24.04.5 LTS CLI)

| Metric | Cold Range Boot (Boot 1) | Warm OPFS Reboot (Boot 2) | Full Disk Image Size |
|---|---|---|---|
| **HTTP 206 Requests** | 21 (1 probe + 20 blocks) | 1 (probe only) | N/A |
| **Bytes Transferred** | 20,972,032 B (20.0 MiB) | 512 B | 2,147,483,648 B (2.0 GiB) |
| **% of Disk Downloaded** | **0.97%** | **0.00002%** | 100% |
| **Chunk Requests Fallback** | 0 | 0 | N/A |
| **Time to Usable Shell** | 2,625 ms | 4,230 ms (incl. UI nav) | N/A |

---

## 3. Test Evidence
- `node weblinux-local/tests/runtime-foundations/range-disk.test.js`: **PASSED** (live Vite 206 vs Chunk byte equality, cross-block reads, bounded LRU cache hit, concurrent dedup, end-of-disk tail, out-of-bounds `RangeError`, `200 OK` fallback, invalid `Content-Range`, ETag mid-session invalidation).
- `node weblinux-local/tests/runtime-foundations/test-browser-range-boot.js`: **PASSED** (real Edge cold & warm Ubuntu CLI boots via `/disk/ubuntu-24.04/rootfs.img`).
