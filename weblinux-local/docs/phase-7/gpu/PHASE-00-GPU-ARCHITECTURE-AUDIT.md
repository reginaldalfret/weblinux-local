# Phase 0 — Complete GPU Architecture Audit

## 1. Executive Summary

WebLinux Local already ships the upstream `rvwasm` GPU transport and browser executor scaffolding, **not** an unimplemented stub:
- **Guest GPU Server:** `/run/rvgpu/boot.js` + `/run/rvgpu/server.js` (started via `HOSTNODE_HOME=/run/rvgpu /run/hostnode/hostnode`), implementing Mesa's `vtest` Unix socket (`$XDG_RUNTIME_DIR/rvgpu-0`) and a `4 MiB` shared-memory command ring in WebAssembly guest memory.
- **Browser Executor:** `apps/web/public/gpu-exec.js` (`window.rvGpu`), which listens on `BroadcastChannel("rv-gpu-" + window.rvTabId)`, reads commands from the shared-memory ring, and supports three execution modes (`selectExec()`):
  1. `vrend` (default): Spawns `new Worker("/gpu-exec.js")`, loads `/vrend/vrend.js` + `/vrend/vrend.wasm` (`virglrenderer 1.1.1` compiled to WebAssembly/WebGL2 with `FULL_ES3=1`), and renders guest `virpipe` GL commands into WebGL2 textures/ImageBitmaps.
  2. `webgpu`: Spawns `rvgpu-worker.js` (`rvgpu.wasm`, Venus/Zink on WebGPU, requires `rv-site.json` or `?exec=webgpu` + JSPI).
  3. `proto`: Built-in pure-JS minimal `Executor` class in `gpu-exec.js` (no VirGL caps, `H_CAPS_LEN = 0`, refuses complex shaders).
- **Display Presentation:** `apps/web/public/display.js` (`window.rvDisplay`), which composites both SHM software surfaces and `window.rvGpu.texture(pid, res, present)` GPU surfaces onto the WebGL2 `<canvas id="display-canvas">` / `#screen`.

## 2. End-to-End Graphics Pipeline Diagram

```text
+-----------------------------------------------------------------------------+
| GUEST (RISC-V 64-bit NOMMU Linux 6.6.0 / Ubuntu 24.04.5 Noble)              |
|                                                                             |
|  [Qt5 / Plasma / Konsole / Dolphin / es2gears_wayland]                      |
|         |  (EGL / OpenGL ES 2.0/3.0)                                        |
|         v                                                                   |
|  [Mesa 25.2.8: libgallium-25.2.8 + libEGL_mesa + libGLX_mesa]               |
|         |  GALLIUM_DRIVER=virpipe                                           |
|         |  VTEST_SOCKET_NAME=/tmp/runtime-root/rvgpu-0                      |
|         v                                                                   |
|  [gpuserver: /run/hostnode/hostnode (HOSTNODE_HOME=/run/rvgpu)]             |
|         |  vtest Unix socket -> 4 MiB shared-memory ring in Wasm memory     |
|         |  BroadcastChannel("rv-gpu-<rvTabId>") { type: "gpu", version: 2 } |
+---------+-------------------------------------------------------------------+
          |
          v  (SharedArrayBuffer / WebAssembly.Memory + BroadcastChannel)
+-----------------------------------------------------------------------------+
| HOST BROWSER (Microsoft Edge / Chromium)                                    |
|                                                                             |
|  [gpu-exec.js (Main Thread)] -> spawns Worker("/gpu-exec.js")               |
|         |  importScripts("/vrend/vrend.js") -> loads /vrend/vrend.wasm      |
|         |  virglrenderer 1.1.1 (libvirglrenderer.a + libepoxy + rvgpu.c)    |
|         v                                                                   |
|  [OffscreenCanvas WebGL2 Context] -> ANGLE D3D11 (GeForce RTX 2050)         |
|         |  transfers ImageBitmap / texture to window.rvGpu.texture()        |
|         v                                                                   |
|  [display.js (Main Thread WebGL2)] -> composites to #screen                 |
+-----------------------------------------------------------------------------+
```

## 3. Protocol & Wire Format Findings

- **Protocol:** Custom shared-memory ring (`RING_MAGIC`, version 2, 16-byte aligned command records) carrying **VirGL / Mesa vtest** command streams (`vtest` commands + `virglrenderer` 3D command buffers) plus optional Venus (`vkr`) capsets.
- **Guest Mesa Driver:** Ubuntu 24.04.5 Noble ships Mesa `25.2.8-0ubuntu0.24.04.5` (`libgallium-25.2.8-0ubuntu0.24.04.5.so`, `libdril_dri.so`, `virtio_gpu_dri.so`), which supports `GALLIUM_DRIVER=virpipe` over `VTEST_SOCKET_NAME`.
- **Upstream Build Source:** `E:\Web-Linux\upstream-rvwasm\gpu\vrend\` contains `build.sh`, `rvgpu.c`, `virglrenderer-wasm.diff`, and the `epoxy` WebGL2 shim to compile `vrend.js` + `vrend.wasm`.

## 4. Exact Root Cause of `no executor has answered in 10 s`

Live diagnostic probing (`tests/diag-gpu-handshake.js`) captured `window.rvGpu.stats` at `17s` after launch:
- `gpu-exec.js` **did** receive `{ type: "gpu", version: 2 }` from `gpuserver`.
- `gpu-exec.js` selected `vrend` (`"site default vrend"`) and spawned the `vrend` Worker.
- The `vrend` Worker failed immediately with:
  `vrend.js failed to load: Failed to execute 'importScripts' on 'WorkerGlobalScope': The script at 'http://localhost:3000/vrend/vrend.js' failed to load.`
- Because `/vrend/vrend.js` and `/vrend/vrend.wasm` were missing from `apps/web/public/`, `EXEC_STATE` remained `0`, causing `gpuserver` to time out after 10 seconds and fall back to software rendering.
