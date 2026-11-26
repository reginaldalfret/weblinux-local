# Phase 9.1 — Final Qualification Report

## 1. Qualification Status

- **Desktop & Storage Status:** `ARCH KDE FULLY VALIDATED`
- **Qt6 RVGPU Status:** `ARCH QT6 RVGPU BLOCKED — SOFTWARE FALLBACK ACTIVE`

## 2. Verified Test Matrix

| Check | Result | Evidence |
|---|---|---|
| Arch OPFS Home Durability (`tests/test-phase91-arch-persistence.js`) | **PASS (exit 0)** | `16437` bytes (`SHA-256: 4c07826feaec647fe83b1579c78ed8cfc05c33d1d5cce923dee34ebdbb95dfbf`) + `RELOAD_MARKER_91` verified byte-for-byte identical across Power Off and `page.reload()` in persistent Edge context; zero `EXT4-fs error` |
| Pacman Configuration Safety | **PASS** | `SigLevel = Required DatabaseOptional` intact; `DisableSandbox` + `#DownloadUser = alpm` verified required for `6.6.0-wasm64_nommu` |
| Qt 6.12 RVGPU Diagnostic (`tests/test-phase91-qt6-rvgpu.js`) | **PASS (diagnosed)** | Standalone `qml6` (`Qt 6.12` `QRhi`) connected to `vrend-webgl2` (`26` command records); full `plasmashell` preserves `QT_QUICK_BACKEND=software` fallback |
| Live Arch KDE 6 (`tests/test-phase9-arch-kde.js`) | **PASS (exit 0)** | Boot `23.5s`, Plasma 6.8.3 + panel, Kickoff, Konsole, Dolphin, `pacman` HTTPS `200`, warm reboot `33.9s` |
| Ubuntu/Debian Networking (`tests/test-phase8-networking.js`) | **PASS (exit 0)** | DNS `104.20.23.154`, HTTPS `200`, RFC1918 blocked |
| Ubuntu KDE RVGPU (`tests/test-phase7-kde-rvgpu.js`) | **PASS (exit 0)** | `guestConnected: true`, `149` records, `vrend-webgl2`, `errors: []` |
| Ubuntu KDE Acceptance (`tests/test-phase652-acceptance.js`) | **PASS (exit 0)** | Cold `25s`, warm `36s`, clean shutdown `9.5s` |
| Production Build (`apps/web` `npm run build`) | **PASS (exit 0)** | `tsc && vite build` succeeded |

## 3. Commits (`origin/feature/runtime-foundations`)

- `89a9cc6` — `test(arch): add persistent-context OPFS home durability test`
- `e14a4f0` — `test(arch): add Qt 6.12 QRhi virpipe RVGPU diagnostic test`
- Phase 9.1 documentation commit (following this report)
