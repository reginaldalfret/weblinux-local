# Phase 3 — GPU Command Transport Validation

## 1. Transport Architecture
- **Guest → `gpuserver`:** Mesa `virpipe` opens Unix domain socket `/tmp/runtime-root/rvgpu-0` and sends `vtest` protocol messages + VirGL 3D command buffers.
- **`gpuserver` → `gpu-exec.js`:** `gpuserver` (`/run/rvgpu/server.js`) writes 16-byte aligned command records (`RING_MAGIC`, version 2) into a `4 MiB` shared-memory ring in WebAssembly guest memory and announces `{ type: "gpu", version: 2, ring, caps, ... }` on `BroadcastChannel("rv-gpu-" + rvTabId)`.
- **Synchronization:** Atomic `H_HEAD`, `H_TAIL`, `H_DONE`, `H_EXEC_STATE` (`1` = ready, `2` = context lost, `3` = failed, `4` = deferred), and `H_EXEC_HEARTBEAT`.

## 2. Live Ring Telemetry (`tests/test-phase7-kde-rvgpu.js`)
- `capsLen`: `1408` bytes
- `records`: `1,235`
- `submits`: `100`
- `bytes`: `82,404`
- `puts`: `797` (`33,405,720` bytes)
- `gets`: `81` (`60,428,800` bytes)
- `errors`: `[]` (zero protocol or ring errors)
