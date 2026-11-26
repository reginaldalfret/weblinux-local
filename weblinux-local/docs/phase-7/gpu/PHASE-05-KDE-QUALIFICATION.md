# Phase 5 — Ubuntu KDE Qualification with RVGPU

## 1. Live Verification (`tests/test-phase7-kde-rvgpu.js`)
- **Executor Registration:** `gpuserver: the executor is here (1408 bytes of caps, 0 of the venus capset, 250-413 ms after our start)`
- **Qt Quick Backend:** `qt.scenegraph.general: threaded render loop`, `Using sg animation driver`, `Animation Driver: using vsync: 16.67 ms`.
- **Plasma 5.27 Rendering:** Breeze wallpaper and crisp Breeze Light bottom panel rendered in OpenGL (`p7-02-plasma-rvgpu.png`).
- **3D OpenGL ES Workload (`es2gears_wayland`):** Rendered rotating lit 3D gears (`300x300` window) on top of Plasma (`p7-03-es2gears-on-plasma.png`) with `1,235` VirGL records executed on `ANGLE NVIDIA GeForce RTX 2050` and `0` errors.
