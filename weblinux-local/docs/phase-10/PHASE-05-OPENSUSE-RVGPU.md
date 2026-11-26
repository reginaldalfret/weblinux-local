# Phase 10 — openSUSE Tumbleweed RVGPU & Graphics Qualification

## 1. Graphics Stack

- **Guest Mesa:** `Mesa-26.2.5-1.1.riscv64`, `Mesa-dri-26.2.5-1.1.riscv64`, `Mesa-libEGL1-26.2.5-1.1.riscv64`, `Mesa-demo-egl-9.0.0-7.1.riscv64`
- **Qt / Plasma:** `qt6-wayland-6.12.0-3.1.riscv64`, `plasma6-workspace-6.8.2-1.1.riscv64`, `kwin6-6.8.2-2.1.riscv64`
- **Host GPU Executor:** `vrend-webgl2` (`ANGLE (NVIDIA, NVIDIA GeForce RTX 2050 (0x000025AD) Direct3D11 vs_5_0 ps_5_0, D3D11)`)

## 2. Runtime Behavior & Fallback

- `gpuserver` initialized cleanly on `/tmp/runtime-root/rvgpu-0` (`GALLIUM_DRIVER=virpipe`).
- Following Phase 9.1 findings on Qt `6.12.0` `QRhi` multi-surface `virpipe` disconnects in `plasmashell`, `opensuse-kde-session` runs `plasmashell --no-respawn` with `QT_QUICK_BACKEND=software QMLSCENE_DEVICE=softwarecontext LIBGL_ALWAYS_SOFTWARE=1` while leaving `gpuserver` (`rvgpu-0`) active.
- **Status:** `OPENSUSE QT6 RVGPU BLOCKED — SOFTWARE FALLBACK ACTIVE` (desktop, panel, Kickoff, Konsole, and Dolphin render cleanly).
