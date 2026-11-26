# Phase 9.1 — Qt 6.12 & RVGPU Compatibility Qualification

## 1. Independent Qt 6.12 `QRhi` + `virpipe` Investigation (`tests/test-phase91-qt6-rvgpu.js`)

Running a standalone minimal Qt 6.12.0 QML window (`qml6 /tmp/t.qml`) with `GALLIUM_DRIVER=virpipe`, `VTEST_SOCKET_NAME=/tmp/runtime-root/rvgpu-0`, `QSG_INFO=1`, and `QT_LOGGING_RULES=qt.rhi.*=true` (`task-8573`) produced:

- `qt.scenegraph.general: Creating QRhi with backend OpenGL for window 0x15db80`
- `qt.rhi.general: Created OpenGL context QSurfaceFormat(version 2.1, ...)`
- `qt.rhi.general: OpenGL VENDOR: Mesa RENDERER: virgl (WebKit WebGL) VERSION: 2.1 Mesa 26.3.1-arch1.3`
- `qt.rhi.rub: [rub] new frame` (rendered 3 frames cleanly)
- Browser RVGPU capabilities: `guestConnected: true`, `activeBackend: "vrend-webgl2"`, `renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 2050 (0x000025AD) Direct3D11 vs_5_0 ps_5_0, D3D11)"`, `commandRecords: 26`.

## 2. Comparison with Full `plasmashell` 6.8.3 (`Qt 6.12.0`) vs Ubuntu `5.27` (`Qt 5.15.13`)

- **Ubuntu 24.04.5 (`Qt 5.15.13`):** Uses Qt 5's legacy OpenGL QSG backend (no `QRhi`), staying stably connected to `gpuserver` (`149` command records, `errors: []`).
- **Arch Linux (`Qt 6.12.0` + `Mesa 26.3.1`):** While a single-window `qml6` app renders over `virpipe`, full `plasmashell` 6.8.3 (desktop + panel + multi-surface `QRhi` texture atlases) disconnects from `gpuserver` (`lost connection to rendering server on 8 read 0 2` / `0 32`), dropping the Plasma panel.

## 3. Production Decision

- Preserve `QT_QUICK_BACKEND=software`, `QMLSCENE_DEVICE=softwarecontext`, and `LIBGL_ALWAYS_SOFTWARE=1` for `plasmashell --no-respawn` in `scripts/package-arch-kde-image.sh` so the Plasma 6.8.3 desktop, panel, Kickoff, Konsole, and Dolphin remain 100% stable.
- Keep `gpuserver` (`rvgpu-0.ready`) active for standalone `virpipe` GL/Qt6 workloads.
- **Status:** `ARCH QT6 RVGPU BLOCKED — SOFTWARE FALLBACK ACTIVE`.
