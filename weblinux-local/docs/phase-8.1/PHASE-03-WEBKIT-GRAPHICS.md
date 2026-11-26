# Phase 8.1 — Phase 3: WebKitGTK 6.0 Graphics & RVGPU Analysis

**Date:** 2026-11-26

---

## 1. Graphics Architecture Separation

| Layer | Active Backend | Status |
|---|---|---|
| **WebLinux Desktop / Plasma** | `wlserver` + `virglrenderer 1.1.1` (`vrend-webgl2`) | **PASS** (`commandRecords: 1253`, `submits: 100`, `errors: []` in `test-phase7-kde-rvgpu.js`) |
| **GTK4 / Epiphany Window Chrome** | `GSK_RENDERER=cairo` | **PASS** (bypasses GTK4 `ngl`/`llvmpipe` shader compilation stall) |
| **WebKitGTK 6.0 Page Renderer** | Software (`WEBKIT_DISABLE_COMPOSITING_MODE=1`, `WEBKIT_DISABLE_DMABUF_RENDERER=1`, `LIBGL_ALWAYS_SOFTWARE=1`) | **PASS** (`MiniBrowser` rendered `https://example.com/` cleanly) |
| **WebKitGTK 6.0 Accelerated Compositing** | EGL / DMA-BUF / `virpipe` | **BLOCKED / UNSTABLE** |

---

## 2. Observed Compositing Behavior

1. **GTK4 `GSK_RENDERER`:**
   - Ubuntu 24.04's GTK 4.14 defaults to `ngl`/`gl`, which stalls compiling GLSL shaders on software `llvmpipe` under RISC-V NOMMU. Setting `GSK_RENDERER=cairo` enables immediate GTK4/Libadwaita window rendering.
2. **WebKitGTK 6.0 Compositing Mode:**
   - Testing without `WEBKIT_DISABLE_COMPOSITING_MODE=1` (`task-7938`) caused `WebKitWebProcess` EGL/Mesa initialization to freeze/crash the guest display after `2m33s` (`p8-02-epiphany-after-fccache.png` black screen + command timeout).
   - With `WEBKIT_DISABLE_COMPOSITING_MODE=1` + `WEBKIT_DISABLE_DMABUF_RENDERER=1` + `LIBGL_ALWAYS_SOFTWARE=1`, `WebKitWebProcess` uses shared-memory (`memfd`) software rasterization and renders cleanly without crashing `wlserver`.
3. **Why WebKitGTK Does Not Use RVGPU Directly:**
   - WebKitGTK 6.0's accelerated compositing requires `EGL_MESA_image_dma_buf_export` / `GBM` / `zwp_linux_dmabuf_v1` buffer passing between `WebKitWebProcess` and the UI process. The WebLinux `/run/rvgpu` transport exposes VirGL vtest sockets (`rvgpu-0`) for Mesa `virpipe` clients, not kernel DRM/GBM/DMA-BUF PRIME fds (`wl_drm` / `zwp_linux_dmabuf_v1`).
   - Therefore, software WebKit rasterization (`WEBKIT_DISABLE_COMPOSITING_MODE=1` + `WEBKIT_DISABLE_DMABUF_RENDERER=1` + `GSK_RENDERER=cairo`) is the required reliable backend for WebKitGTK 6.0 on WebLinux.
