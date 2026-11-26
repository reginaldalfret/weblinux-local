# Phase 4 — WebGL2 Renderer (`vrend.wasm`) Implementation

## 1. Compiled `virglrenderer 1.1.1` WebAssembly Executor
- Built from `E:\Web-Linux\upstream-rvwasm\gpu\vrend\` using Emscripten `3.1.73` (`meson` + `ninja`, `-sMIN_WEBGL_VERSION=2 -sMAX_WEBGL_VERSION=2 -sFULL_ES3=1 -sSTACK_SIZE=4194304`).
- Artifacts deployed to `apps/web/public/vrend/` (and `apps/web/public/runtime/vrend/`):
  - `vrend.js`: `112,886` bytes
  - `vrend.wasm`: `486,541` bytes
- **Worker Initialization:**
  - `vrend: gl_version 30 - es profile enabled`
  - `vrend: GLSL feature level 130`
  - `workerRenderer`: `ANGLE (NVIDIA, NVIDIA GeForce RTX 2050 (0x000025AD) Direct3D11 vs_5_0 ps_5_0, D3D11)`
- **Application Lifecycle API:** Added `GraphicsMode` (`'software' | 'experimental-rvgpu' | 'automatic'`) and `GraphicsCapabilities` (`getGraphicsCapabilities()`, `setGraphicsMode()`) to `runtime/types.ts` and `WasmLinuxAdapter.ts`.
