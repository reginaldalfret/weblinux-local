# PHASE 01 — OPFS Durability, Consistency, and Recovery

**Status:** VERIFIED & PASSED  
**Branch:** `feature/runtime-foundations`

---

## 1. Storage Architecture & Failure Scenarios Addressed
Before Phase 1, `disk-worker.js` suffered from four durability hazards:
1. **Abrupt Worker Termination:** `linux.js` called `dw.terminate()` while `disk-worker.js` was blocked inside `Atomics.wait()`, risking lost `unsaved` pieces and unclosed `FileSystemSyncAccessHandle`s.
2. **Silent Multi-Tab Fallback:** `NoModificationAllowedError` caused a silent fallback to in-memory-only storage while still posting `ready`.
3. **Unchecked Metadata Integrity:** `map` had no CRC32 or generation journal to detect interrupted writes.
4. **Quota Error Misclassification:** `QuotaExceededError` triggered `storage_lost()`, discarding OPFS handles instead of returning `-ENOSPC`.

---

## 2. Implemented Storage Contract

### 2.1 Single-Writer Ownership (`navigator.locks`)
- `acquire_disk_lock(name)` in `apps/web/public/disk-worker.js` requests an exclusive Web Lock `weblinux-disk-lock-<name>` with `{ ifAvailable: true }`.
- If another tab or worker actively owns the lock, the worker posts `{ method: 'lock_conflict', code: 'DISK_LOCKED' }` and refuses to silently take over the disk.
- On `OP_SHUTDOWN` or tab crash/close, the lock is cleanly released.

### 2.2 Dual-Slot Metadata Journal (`disk-<name>/meta`)
- Companion 128-byte `meta` file (`OpfsDurability.ts` + `disk-worker.js`) stores alternating 64-byte Slot A / Slot B commit records:
  - Magic `RVM1` (`0x52564d31`), version `1`, `generation` (`uint32`), `flags` (`OPFS_FLAG_DIRTY`), `places`, `mapCrc32`, `pieceCount`, `pieceSize`, and `entryCrc32` (IEEE 802.3 CRC32).
- **Non-Destructive Legacy Upgrade:** Existing v1 disks (`data` + `map` without `meta`) are upgraded in-place to Generation 1 on first open with zero data loss.
- **Two-Phase Commit in `save()`:**
  1. `data.flush()`
  2. Write `dirty = 1` to next slot `(gen + 1) % 2` -> `meta.flush()`
  3. Write `place` table to `map` -> `map.flush()`
  4. Write `dirty = 0` + `mapCrc32` + `entryCrc32` -> `meta.flush()`

### 2.3 Quota & Error Propagation
- Added `ENOSPC = 28` in `disk-worker.js`. `QuotaExceededError` / `FILE_NO_SPACE` returns `-ENOSPC` to the guest kernel and emits `{ method: 'storage_error', code: 'QUOTA_EXCEEDED' }` without discarding committed OPFS data.
- Added `OpfsManager.checkQuotaForOperation(estimatedBytes)` and `OpfsManager.inspectDiskMetadata(diskName)`.

### 2.4 Coordinated Shutdown (`OP_SHUTDOWN = 3`)
- `WasmLinuxAdapter.shutdown()` awaits `activeOs.terminate()`.
- `linux.js` terminates CPU/task workers first, then sends `OP_SHUTDOWN` (`control[3] = 3`) via `SharedArrayBuffer` to each disk worker, waits for `shutdown_complete` (OPFS flush + `meta` commit + `handle.close()` + Web Lock release), and only then terminates the disk worker.

---

## 3. Test Evidence
1. **Unit & Recovery Suite (`node weblinux-local/tests/runtime-foundations/opfs-durability.test.js`):** **7/7 PASSED** (CRC32 vector, encode/decode, bit-flip rejection, dual-slot progression, dirty Gen 3 rollback to Gen 2, corrupted Slot A rollback, geometry mismatch rejection).
2. **Live Browser Edge Suite (`node weblinux-local/tests/runtime-foundations/test-browser-opfs-durability.js`):** **PASSED**
   - `lockDetected: true` (`DISK_LOCKED` on concurrent second writer)
   - `wrRes: 0`, `flRes: 0`, `sdOk: true`, `generation: 3`
   - `w3Kept: true`, `readBackMatches: true`, `metaSize: 128`
