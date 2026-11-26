# Phase 6 — Software vs. RVGPU Performance Benchmarks

Measured in Microsoft Edge (`1600x950`, `2048 MiB` guest RAM, Ubuntu 24.04.5 LTS KDE Plasma 5.27):

| Metric | Software Mode (Phase 6.5.2) | RVGPU `vrend-webgl2` Mode (Phase 6.5.4) |
|---|---|---|
| **Executor Initialization** | `N/A` (failed 404 on `vrend.js`) | `250–413 ms` (`1,408` bytes caps) |
| **Runtime-Ready (`running` + `shellReady`)** | `36s` (cold) / `24s` (warm w/ UDisks2 fix) | `21s` |
| **Plasma Splash Dismissed + Panel Mapped** | `167s` (cold) | `130s` |
| **Qt Quick Scene Graph** | `software` (`QMLSCENE_DEVICE=softwarecontext`) | OpenGL (`threaded render loop`, `16.67 ms` vsync) |
| **GPU Command Records Executed** | `0` | `1,235` records (`100` submits, `82,404` bytes, `0` errors) |
| **3D OpenGL ES (`es2gears_wayland`)** | Software fallback | `vrend-webgl2` on `ANGLE NVIDIA GeForce RTX 2050` |
| **Note on CPU Bound Operations** | Guest ELF instructions still run via `/bin/rv` | Guest ELF instructions still run via `/bin/rv`; GPU rasterization offloaded |
