# PHASE 04 — VirGL Graphics Acceleration Investigation and Prototype

**Classification:** `VIRGL PARTIALLY VALIDATED`  
**Branch:** `feature/runtime-foundations`

---

## 1. Existing Graphics Path Audit
- **Established Production Path:** Guest applications -> Wayland (`wlserver`) / framebuffer -> `display.js` -> WebGL2 `<canvas id="screen">`. Under Ubuntu GNOME 46, `LIBGL_ALWAYS_SOFTWARE=1` renders via Mesa `swrast_dri.so` / `llvmpipe`, with `display.js` compositing surfaces on WebGL2.
- **Host VirGL Infrastructure Present:** `apps/web/public/gpu-exec.js` implements an `RVGP` shared-memory command ring (`OP_CTX_CREATE`, `OP_RES_CREATE`, `OP_SUBMIT`, `OP_TRANSFER_PUT`, `OP_TRANSFER_GET`, `OP_PRESENT`) with a built-in WebGL2 VirGL command decoder (`proto`) and hooks for `vrend` / `rvgpu-worker.js` (WebGPU).
- **Guest VirGL Infrastructure Present:** Initramfs `/usr/lib/rvgpu/` contains `server.js` (`vtest` socket server), `boot.js`, and `venus/`. Ubuntu GNOME 46 rootfs contains `/usr/lib/riscv64-linux-gnu/dri/virtio_gpu_dri.so` and `dri_gbm.so`.

---

## 2. Kernel & Runtime Compatibility Findings
1. **Kernel DRM / VirtIO-GPU (`vmlinux-wasm64_nommu.wasm`):**
   - Inspected `WebAssembly.Module.exports` directly: **`virtio*`, `drm_*`, and `virtgpu*` symbols are absent** (`CONFIG_VIRTIO`, `CONFIG_DRM`, `CONFIG_DRM_VIRTIO_GPU` are not enabled in the kernel build).
   - Therefore, kernel-level `/dev/dri/renderD128` DRM/KMS (`RVGPU_DRM=1`) is **blocked**.
2. **Userspace `vtest` + `virpipe` Path:**
   - Mesa `virpipe` (`GALLIUM_DRIVER=virpipe`, `VTEST_SOCKET_NAME=/run/user/0/rvgpu-0`) routes VirGL commands over Unix socket to `/run/rvgpu/server.js`, which writes into the `RVGP` shared-memory ring consumed by `gpu-exec.js`.
3. **Renderer Binary Gap (`vrend.wasm` / `rvgpu.wasm`):**
   - `vrend.wasm` (full `virglrenderer` GLES-on-WebGL2) and `rvgpu.wasm` (WebGPU `wgvk`) are **not bundled** in `apps/web/public/`.
   - `gpu-exec.js`'s built-in `proto` decoder handles basic VirGL commands (`CCMD_CREATE_OBJECT`, `CCMD_BIND_SHADER`, `CCMD_CLEAR`, `CCMD_DRAW_VBO`, simple TGSI-to-GLSL ES 3.00 shaders), which is sufficient for minimal 3D draws (`gpu-demo.html`), **not** full Mutter/GNOME Shell GLES3 composition.

---

## 3. Isolated Experimental Flag & Prototype Verification
- Added `WEBLINUX_ENABLE_VIRGL_EXPERIMENTAL` (default `false`; opt-in via `window.WEBLINUX_ENABLE_VIRGL_EXPERIMENTAL = true` or `?virgl=1`) in `WasmLinuxAdapter.ts`.
- Default rendering path (`LIBGL_ALWAYS_SOFTWARE=1` + `display.js` WebGL2 bridge) remains 100% intact.
- **Prototype Benchmark (`node weblinux-local/tests/runtime-foundations/test-virgl-prototype.js` in Microsoft Edge):**
  - Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 2050 Direct3D11 vs_5_0 ps_5_0, D3D11)`
  - VirGL Executor: `proto` (`gpu-exec.js`)
  - `records`: **67**, `submits`: **62**, `draws`: **61**, `clears`: **61**, `glCalls`: **1,545**, `execMs`: **16.61 ms** (~0.27 ms/draw), `errors`: **[]**

---

## 4. Prioritized Remediation Plan for Full `VIRGL VALIDATED`
1. Build and bundle `vrend.wasm` (Emscripten `virglrenderer`) in `apps/web/public/rvgpu/` so full OpenGL ES 3.0 / GL 2.1 VirGL commands from Mutter and GNOME Shell execute beyond the `proto` subset.
2. Validate `GALLIUM_DRIVER=virpipe` inside `ubuntu-gnome-session` under `vrend.wasm` with `wlserver` Wayland surfaces.
3. Optionally enable `CONFIG_DRM_VIRTIO_GPU` in `vmlinux-wasm64_nommu` if kernel-level GBM/dmabuf zero-copy presentation is desired.
