# PHASE 00 — Repository Audit and Baseline Capture

**Date:** 2026-11-25  
**Workspace:** `E:\Web-Linux`  
**Repository:** `https://github.com/reginaldalfret/weblinux-local`  
**Baseline Commit (`feature/ubuntu-24.04-noble`):** `e7cc583`  
**Active Implementation Branch:** `feature/runtime-foundations` (branched cleanly from `e7cc583` to preserve all Phase 6.4 Ubuntu GNOME work and uncommitted local test artifacts)

---

## 1. Git & Working Tree State
- **Starting Branch:** `feature/ubuntu-24.04-noble` at commit `e7cc583` (`feat(phase-6.4): implement genuine Ubuntu 24.04.5 LTS GNOME 46 graphical desktop runtime`).
- **Working Tree Before Branching:** 1 modified test output (`weblinux-local/tests/ubuntu-boot-result.json`) and untracked Phase 5/6 diagnostic scripts/screenshots under `weblinux-local/tests/`.
- **Branching Decision:** Created `feature/runtime-foundations` from `e7cc583` without discarding or resetting any uncommitted files.

---

## 2. Verified Runtime & Kernel Architecture

### 2.1 Kernel Binary (`vmlinux-wasm64_nommu.wasm`)
Verified directly via `WebAssembly.compile()` + `WebAssembly.Module.imports/exports`:
- **Target:** WebAssembly Memory64 (`address: 'i64'`, `shared: true`), `initial: 30` pages, `maximum: 0x10000` pages (4 GiB cap in `weblinux-local/apps/web/public/linux.js:665-672`).
- **Kernel Version:** Linux 6.6.0 `#1 SMP rv riscv64 NOMMU`.
- **Host Imports (`env`):**
  - Block I/O: `wasm_driver_blk_sectors`, `wasm_driver_blk_rw`
  - Framebuffer / Console / Network / Input: `wasm_driver_fb_show`, `wasm_driver_hvc_get`, `wasm_driver_hvc_put`, `wasm_driver_net_tx`, `wasm_driver_net_rx`, `wasm_driver_input_rx`
  - Task/CPU lifecycle: `wasm_create_and_run_task`, `wasm_load_executable`, `wasm_start_cpu`, `wasm_stop_cpu`
- **Filesystem & Graphics Kernel Exports:**
  - `ext4_*`: Present (full kernel ext4 driver).
  - `ovl_*` / `overlayfs`: **Absent** from kernel exports (only `touch_overlay_*` input helpers exist).
  - `virtio*` / `drm_*` / `virtgpu*`: **Absent** from kernel exports.

### 2.2 Guest Userspace & Initramfs
- **Initramfs:** `apps/web/public/initramfs-wasm64_nommu.cpio.gz` (15,057,597 bytes compressed; 36,645,376 bytes uncompressed).
- **RISC-V Execution:** `/bin/rv` registered via `binfmt_misc` in `/init`.
- **Distributions:**
  - **Debian 13 (Trixie) + KDE Plasma 6:** Validated graphical baseline (`/debian`).
  - **Ubuntu 24.04.5 LTS CLI:** Validated CLI (`/ubuntu`, `/disk/ubuntu-24.04/`).
  - **Ubuntu 24.04.5 LTS GNOME 46:** Experimental graphical target (`/ubuntu`, `/disk/ubuntu-24.04-gnome/`), using `GJS_DISABLE_JIT=1`, `JS_DISABLE_JIT=1`, and `gnome-shell --nested --wayland`.

---

## 3. Existing Disk & OPFS Architecture Audit

Authoritative implementation lives in `weblinux-local/apps/web/public/disk-worker.js` (1,273 lines, mirrored identically at `apps/web/public/runtime/disk-worker.js`), `weblinux-local/apps/web/public/linux.js`, `weblinux-local/runtime/adapters/WasmLinuxAdapter.ts`, and `weblinux-local/runtime/filesystem/OpfsManager.ts`.

### 3.1 How Disks Are Stored & Accessed
- Each virtual disk (`root-<distro>-<desktop>`, `home-<distro>`) opens a directory `disk-<name>` in OPFS (`navigator.storage.getDirectory()`).
- Inside `disk-<name>`, two files are opened with `createSyncAccessHandle()`:
  - `data`: Stores fetched/written 1 MiB pieces sequentially in arrival order.
  - `map`: 64-byte `HEADING` (`rvdisk 1 <id> <piece_size> <pieces>`) followed by a `Uint32Array` `place` table mapping piece index -> slot + 1 in `data`.
- Kernel block requests (`OP_READ = 0`, `OP_WRITE = 1`, `OP_FLUSH = 2`) pass through `SharedArrayBuffer` (`control` Int32Array) using `Atomics.wait` / `Atomics.notify`.
- A secondary fetcher worker (`disk-fetcher`) performs asynchronous read-ahead and `boot` list prefetching.

### 3.2 Identified OPFS Durability & Lifecycle Gaps (P0 Risks)
1. **Abrupt Worker Termination on Shutdown:** `linux.js:951-953` calls `dw.terminate()` directly. Because `disk-worker.js` blocks synchronously inside `serve()` (`Atomics.wait`), it cannot handle `postMessage` shutdown requests, flush pending `unsaved` pieces, update `map`, or call `handle.close()`.
2. **Silent Fallback on Multi-Tab Lock Contention:** In `disk-worker.js:1032-1052`, if `createSyncAccessHandle()` throws `NoModificationAllowedError` after 40 retries (2s), the worker logs a message and silently continues in memory-only mode (`data = null`), returning `ready` with `kept: false` instead of surfacing an explicit writer-lock error.
3. **Destructive Image ID Mismatch:** In `disk-worker.js:1075-1085`, if `heading` differs (e.g., server updated `manifest.id`), `data.truncate(0)` and `map.truncate(0)` immediately wipe the local OPFS disk.
4. **Error Swallowing / Unbounded In-Memory Fallback:** `storage_lost()` handles `QuotaExceededError` identically to evicted storage, dropping OPFS handles without distinguishing quota exhaustion or exposing structured error codes to `WasmLinuxAdapter`.
5. **Dual Copy Drift Risk:** `public/disk-worker.js` and `public/runtime/disk-worker.js` must remain synchronized.

---

## 4. Existing Disk Delivery Audit (P1)
- Currently `disk-worker.js` fetches individual 1 MiB chunk files (`base + padded_index` via sync `XMLHttpRequest`, or `remote + hash` via `fetch()`).
- No `VirtualBlockSource` interface exists.
- No HTTP `Range` (`206 Partial Content`) transport exists, and no consolidated `rootfs.img` artifact exists for Ubuntu 24.04.5.

---

## 5. Existing Copy-on-Write Capability Audit (P2)
- Kernel `vmlinux-wasm64_nommu.wasm` has **no OverlayFS (`ovl_*`) support**.
- Therefore, **Option B (Block-Level Copy-on-Write)** in the virtual block layer (`disk-worker.js` / OPFS) is the required architecture: immutable base image + separate writable upper layer + generation/snapshot metadata, completely isolated from `home-<distro>`.

---

## 6. Existing Graphics & VirGL Path Audit (P3)
- **Display Bridge:** `display.js` renders framebuffer / Wayland compositor (`wlserver`) surfaces via WebGL2 on `<canvas id="screen">`.
- **Existing VirGL / RVGPU Prototype:** `apps/web/public/gpu-exec.js` (1,735 lines), `rvgpu-worker.js`, `gpu-stub.js`, and initramfs `/usr/lib/rvgpu/` (`server.js`, `boot.js`, `vdec.js`, `venus/`) implement a **userspace** VirGL command ring (`RVGP` in shared memory) and `vtest` socket (`VTEST_SOCKET_NAME=$XDG_RUNTIME_DIR/rvgpu-0`), supporting `vrend` (WebGL2) and `webgpu` executors.
- **Gap:** Kernel has no `CONFIG_DRM_VIRTIO_GPU` / `virtio` exports; `WasmLinuxAdapter.ts` passes `enableGpu: true, gpuExecutor: 'vrend'` in `BootOptions` (`App.tsx:113-114`), but `WasmLinuxAdapter.boot()` does not wire `gpu-exec.js` or `RVGPU` kernel/env flags for Ubuntu GNOME 46, and `ubuntu-gnome-session` exports `LIBGL_ALWAYS_SOFTWARE=1`.

---

## 7. Baseline Test & Build Commands
Verified working in `E:\Web-Linux`:
- **Frontend TypeScript + Vite Build:** `Set-Location "E:\Web-Linux\weblinux-local\apps\web"; npm run build` (passed in 25.57s).
- **Phase 6 Ubuntu Regression Suite (10 suites):** `node weblinux-local/tests/phase6-ubuntu/run-all-tests.js` (10/10 passed).
- **Live Browser Acceptance (Edge):** `node weblinux-local/tests/test-live-ubuntu-gnome.js` and `node weblinux-local/tests/test-live-ubuntu.js`.

---

## 8. Phased Implementation Plan
1. **Phase 1 (P0 — OPFS Durability):** Add `SharedArrayBuffer` graceful shutdown & flush (`OP_SHUTDOWN`), explicit single-writer lock coordination (`navigator.locks` / `BroadcastChannel` + explicit lock-error reporting), generation-checked metadata headers with `CRC32` checksums, `QuotaExceededError` propagation & `OpfsManager` quota warnings, and a comprehensive Node/Browser OPFS durability test suite.
2. **Phase 2 (P1 — HTTP Range Disk Loading):** Implement `VirtualBlockSource` abstraction (`ChunkBlockSource`, `RangeBlockSource` with real `206` probe, ETag validation, bounded LRU cache, in-flight dedup, fallback to chunks), generate consolidated `ubuntu-24.04/rootfs.img`, and benchmark cold/warm boot vs. chunk loader.
3. **Phase 3 (P2 — Block-Level Copy-on-Write):** Implement block-level COW upper layer (`cow-upper` + `cow-meta` with generation snapshots and rollback) in `disk-worker.js` + `OpfsManager`, keeping base images immutable and `home-<distro>` completely isolated.
4. **Phase 4 (P3 — VirGL Graphics Investigation & Prototype):** Audit `gpu-exec.js` + `rvgpu/server.js` + `virpipe` / `vtest` path, wire isolated `WEBLINUX_ENABLE_VIRGL_EXPERIMENTAL` flag, test real VirGL command submission + GNOME 46 Mesa `virpipe` compatibility in browser, and benchmark.
5. **Phase 5 (Integration & Qualification):** Regression-test Debian KDE, Ubuntu CLI, and Ubuntu GNOME 46 across Edge & Chrome, and deliver all final architecture and qualification reports.
