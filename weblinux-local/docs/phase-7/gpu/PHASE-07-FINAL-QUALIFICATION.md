# Phase 7 — Final GPU Qualification Report

**Qualification State:** **`STATE D — GRAPHICS ACCELERATION VALIDATED`**

## 1. Acceptance Criteria Checklist
- **STATE A — Software Rendering:** Preserved as automatic fallback when `rvgpu` or WebGL2 is unavailable.
- **STATE B — Executor Ready:** `vrend.js` (`112,886` B) and `vrend.wasm` (`486,541` B) load cleanly in `gpu-exec.js` Worker; `gpuserver` registers `1,408` bytes of VirGL caps in `250–413 ms`.
- **STATE C — Guest GPU Connected:** Ubuntu Noble Mesa `25.2.8` (`GALLIUM_DRIVER=virpipe`) connects to `/tmp/runtime-root/rvgpu-0` (`guestConnected: true`, `activeBackend: "vrend-webgl2"`).
- **STATE D — Graphics Acceleration Validated:** `plasmashell 5.27.12` (OpenGL threaded render loop) and `es2gears_wayland` (3D rotating gears) executed `1,235` VirGL records (`33.4 MB` puts, `60.4 MB` gets, `0` errors) on `ANGLE NVIDIA GeForce RTX 2050 Direct3D11`, producing visible rendered output in Microsoft Edge (`p7-02-plasma-rvgpu.png`, `p7-03-es2gears-on-plasma.png`).

## 2. Verification & Regression
- `node tests/phase7-gpu/rvgpu-vrend.test.js`
- `node tests/phase6-ubuntu/run-all-tests.js` (11/11 suites)
- `npm run build` in `apps/web` (`tsc && vite build`)
