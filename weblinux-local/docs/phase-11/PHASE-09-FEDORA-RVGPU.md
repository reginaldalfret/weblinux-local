# Phase 11 — Fedora 45 RVGPU & Graphics Qualification

## 1. Graphics Stack

- **Guest Mesa:** `mesa-dri-drivers-0:26.2.0-1.fc45.riscv64`, `mesa-demos-0:9.0.0-12.fc45.riscv64`
- **Qt / Plasma:** `qt6-qtbase-0:6.11.1-5.fc45.riscv64`, `qt6-qtwayland-0:6.11.1-2.fc45.riscv64`, `plasma-workspace-0:6.7.4-1.fc45.riscv64`, `kwin-0:6.7.4-2.fc45.riscv64`
- **Host GPU Executor:** `vrend-webgl2` (`ANGLE (NVIDIA, NVIDIA GeForce RTX 2050 (0x000025AD) Direct3D11 vs_5_0 ps_5_0, D3D11)`)

## 2. Runtime Behavior & Status

- `gpuserver` initializes cleanly on `/tmp/runtime-root/rvgpu-0` (`GALLIUM_DRIVER=virpipe`).
- Consistent with Arch and openSUSE Qt 6 Plasma 6 findings, `fedora-kde-session` runs `plasmashell --no-respawn` with `QT_QUICK_BACKEND=software QMLSCENE_DEVICE=softwarecontext LIBGL_ALWAYS_SOFTWARE=1` so the Plasma 6.7.4 desktop, panel, Kickoff, Konsole, and Dolphin remain 100% stable.
- Note: `es2_info` is not present in Fedora's `mesa-demos-9.0.0-12.fc45` (`eglinfo`/`glxinfo` are used in `mesa-demos` 9.0).
- **Status:** `FEDORA QT6 RVGPU BLOCKED — SOFTWARE FALLBACK ACTIVE`.
