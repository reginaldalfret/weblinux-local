# Phase 9 — Performance & Storage Comparison (Arch KDE 6 vs Ubuntu KDE 5.27)

## 1. Side-by-Side Observed Benchmarks

| Metric | Arch Linux RISC-V + KDE Plasma 6.8.3 (`task-8439`) | Ubuntu 24.04.5 + KDE Plasma 5.27.12 (`task-8473`) |
|---|---|---|
| **Kernel / Architecture** | `6.6.0-wasm64_nommu` / `riscv64` (`RV64GC`, `LP64D`) | `6.6.0-wasm64_nommu` / `riscv64` (`RV64GC`, `LP64D`) |
| **Qt / KDE Stack** | Qt `6.12.0`, Plasma `6.8.3`, KWin `6.8.3`, Konsole/Dolphin `26.08.3` | Qt `5.15.13`, Plasma `5.27.12`, KWin `5.27.11`, Konsole/Dolphin `23.08.5` |
| **Package Count** | `555` signed Arch RISC-V packages | Ubuntu Noble KDE closure |
| **Root Disk Image** | `5.0 GiB` ext4 (`3.6 GiB` used, `3644` non-zero 1 MiB chunks) | Isolated `root-ubuntu-kde` |
| **Cold Boot (`shellReady`)** | `23.5s` | `25s` (`23s` in Phase 7 RVGPU test) |
| **Warm Reboot (`shellReady`)** | `33.9s` | `36s` |
| **Memory Used (Desktop + Apps)** | `1026 MiB` / `2009 MiB` | `~979–1101 MiB` / `2009 MiB` |
| **Plasma Shell Rendering** | Software QML (`QT_QUICK_BACKEND=software`) + `gpuserver` active | `virpipe` OpenGL QSG (`149` command records, `vrend-webgl2`) |
| **OPFS Isolation** | `root-arch-kde` (`/dev/wda`) + `home-arch-kde` (`/dev/wdb`) | `root-ubuntu-kde` (`/dev/wda`) + `home-ubuntu` (`/dev/wdb`) |

## 2. Production Build

- `apps/web` `npm run build` (`tsc && vite build`): **PASSED** in `29.74s` (`2156 modules transformed`, `dist/assets/index-QgWZxAIT.js 367.31 kB`).
