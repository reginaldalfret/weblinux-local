# Phase 1 — Executor Registration Diagnostics

## 1. Failure Observed

Guest log (`ubuntu-kde-session`):
```text
gpuserver: video decoding ring at 113774592
gpuserver: listening on /tmp/runtime-root/rvgpu-0 (ring at 109056000, 4 MiB)
gpuserver: the page's video decoder is here (5 codecs, drawing into GPU resources)
gpuserver: no executor has answered in 10 s (a page without one?): programs draw in software
```

## 2. Stage-by-Stage Trace (`tests/diag-gpu-handshake.js`)

| Stage | Status | Observed Output / Timestamp |
|---|---|---|
| Executor script loaded | **OK** (`0s`) | `window.rvGpu` present; `rvTabId=b47cd518-2016-4549-9289-24c70f7c2b49` |
| WebGL2 / WebGPU host support | **OK** (`0s`) | `hasGl=true`, `hasGpu=true`, `jspi=true`, `ANGLE (NVIDIA GeForce RTX 2050 Direct3D11)` |
| `gpuserver` broadcast received | **OK** (`17s`) | `gpu-exec: vrend (site default vrend)` |
| `vrend` Worker spawned | **OK** (`17s`) | `mode="worker"`, `exec_kind="vrend"`, `readyKind="vrend"` |
| `vrend.js` / `vrend.wasm` load | **FAILED** (`17s`) | `vrend.js failed to load: Failed to execute 'importScripts' on 'WorkerGlobalScope': The script at 'http://localhost:3000/vrend/vrend.js' failed to load.` |
| `EXEC_STATE` & `CAPS_LEN` | **FAILED** (`17–27s`) | `EXEC_STATE` remained `0`; `gpuserver` timed out at `10 s` |

## 3. Resolution

1. Build the genuine `vrend.js` and `vrend.wasm` (`virglrenderer 1.1.1` + `libepoxy` + `rvgpu.c`) from `E:\Web-Linux\upstream-rvwasm\gpu\vrend\` using Emscripten and deploy them to `apps/web/public/vrend/`.
2. Add an application-level `GraphicsMode` (`'software' | 'experimental-rvgpu' | 'automatic'`) and `GraphicsCapabilities` telemetry in `runtime/types.ts` and `WasmLinuxAdapter.ts` so the UI and runtime can inspect `executorLoaded`, `executorReady`, `guestConnected`, `activeBackend`, and fallback state without URL query hacks.
