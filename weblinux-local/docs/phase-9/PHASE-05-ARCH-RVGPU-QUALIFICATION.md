# Phase 9 — Arch Linux RISC-V RVGPU Qualification

## 1. Graphics Stack

- **Guest Mesa:** `mesa 1:26.3.1-3`, `mesa-demos 9.0.0-7`
- **Host GPU Executor:** `gpuserver` (`HOSTNODE_HOME=/run/rvgpu /run/hostnode/hostnode`) -> `vrend-webgl2` -> `ANGLE (NVIDIA, NVIDIA GeForce RTX 2050 (0x000025AD) Direct3D11 vs_5_0 ps_5_0, D3D11)`
- **Transport Socket:** `/tmp/runtime-root/rvgpu-0` (`GALLIUM_DRIVER=virpipe`, `VTEST_SOCKET_NAME=/tmp/runtime-root/rvgpu-0`)

## 2. Observed RVGPU Behavior on Arch Plasma 6.8.3 (`Qt 6.12.0`)

- During initial qualification (`task-8296`), `gpuserver` initialized cleanly and `plasmashell` (`Qt 6.12.0` `QRhi` OpenGL backend) connected over `virpipe`:
  - `GL_RENDERER`: `virgl (WebKit WebGL)`
  - `GL_VERSION`: `2.1 Mesa 26.3.1-arch1.3`
  - `commandRecords`: `573`
- However, Qt 6.12 `QRhi` subsequently triggered `lost connection to rendering server on 8 read 0 2` / `0 32`, disconnecting the `plasmashell` process from `gpuserver` and leaving only the wallpaper without the Plasma panel.
- **Resolution (`scripts/package-arch-kde-image.sh`):**
  - Keep `gpuserver` (`rvgpu-0.ready`) running and active in `/root/rvgpu.log` (`gpuserver: listening on /tmp/runtime-root/rvgpu-0`, `the executor is here (1408 bytes of caps, 0 of the venus capset)`).
  - Launch `plasmashell --no-respawn` with `QT_QUICK_BACKEND=software QMLSCENE_DEVICE=softwarecontext LIBGL_ALWAYS_SOFTWARE=1` so the Plasma 6.8.3 shell, panel, and Kickoff launcher remain 100% stable across multi-minute sessions, while standalone OpenGL/VirGL workloads can still target `rvgpu-0`.
