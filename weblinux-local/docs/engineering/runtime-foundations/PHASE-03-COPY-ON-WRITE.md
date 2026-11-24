# PHASE 03 — Copy-on-Write Root Filesystem and Safe Recovery

**Status:** VERIFIED & PASSED  
**Branch:** `feature/runtime-foundations`

---

## 1. Kernel Capability Audit & Architectural Selection
- **Kernel Export Inspection (`vmlinux-wasm64_nommu.wasm`):** Verified via `WebAssembly.Module.exports` that `overlayfs` (`ovl_*`) is **not compiled** into the Linux 6.6.0 wasm64 NOMMU kernel.
- **Decision:** **Option B — Block-Level Copy-on-Write (`CowBlockLayer`)** implemented in `weblinux-local/runtime/filesystem/CowBlockLayer.ts`.
  - Reads unchanged blocks from the immutable distribution base (`ChunkBlockSource` / `RangeBlockSource`).
  - Copies modified blocks on first write into an isolated upper layer (`upperMap` + `upperBlocks`), leaving the base image untouched.
  - Completely independent of `home-<distro>` (`/dev/wdb`), so rootfs rollback never touches user home directories.

---

## 2. Distribution Isolation & Snapshot/Rollback
- **Per-Distribution Isolation:** `root-debian-kde-plasma`, `root-ubuntu-cli`, and `root-ubuntu-gnome` maintain independent COW layers.
- **Materialized Snapshots:** `createSnapshot(id, label)` copies `upperMap` and `upperBlocks`, computes IEEE 802.3 CRC32 over both map and block payloads, and records `status: 'committed'`.
- **Safe Rollback:** `rollbackToSnapshot(id)` verifies `distroId`, `baseImageId`, `status === 'committed'`, `mapCrc32`, and `dataCrc32` before restoring state. Pending/interrupted or corrupted snapshots are rejected.
- **Safe Base Updates:** `beginBaseUpdate()` snapshots current state prior to switching `baseImageId`; `commitBaseUpdate(false)` automatically rolls back to the pre-update snapshot.

---

## 3. Test Evidence
`node weblinux-local/tests/runtime-foundations/cow-rootfs.test.js` — **8/8 PASSED**:
- Upper-layer write isolation & immutable base SHA-256 unchanged.
- Debian & Ubuntu COW root layers isolated.
- Snapshot & rollback restored exact state without touching home disk.
- Interrupted (`pending`) snapshot rejected.
- Corrupted snapshot CRC32 rejected.
- Failed base update rolled back to last known-good state.
