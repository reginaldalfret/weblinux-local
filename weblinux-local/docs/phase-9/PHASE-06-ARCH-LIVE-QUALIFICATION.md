# Phase 9 — Arch Linux RISC-V Live Qualification

## 1. Test Script & Environment

- **Test Script:** `tests/test-phase9-arch-kde.js`
- **Browser:** Microsoft Edge (Playwright `channel: 'msedge'`) against Vite dev server (`http://localhost:3000`) + `scripts/guest-net-relay.js` (`ws://127.0.0.1:8081`).
- **Artifacts Captured:**
  - `p9-01-arch-selector.png` — Distribution selector showing `Arch Linux RISC-V (Community Port + KDE Plasma 6)`
  - `p9-02-arch-kde-desktop.png` — Plasma 6.8.3 desktop & bottom panel rendered on WebGL2 `<canvas>`
  - `p9-03-arch-launcher.png` — Kickoff application launcher open (`root`, Favorites, System Settings, Dolphin)
  - `p9-04-arch-konsole.png` — `konsole` 26.08.3 running `uname -a` (`Linux rv 6.6.0 #1 SMP rv riscv64 GNU/Linux`) and `cat /etc/os-release` (`NAME="Arch Linux"`, `ID=arch`, `BUILD_ID=rolling`)
  - `p9-05-arch-dolphin.png` — `dolphin` 26.08.3 open over Konsole
  - `p9-06-arch-window-ops.png` — Dolphin `/root` directory loaded (`1 folder, 9 files (13.6 KiB)`) with Breeze icons

## 2. Verified Runtime & Mounts (`task-8439`)

- **Cold Boot to `shellReady` + `waylandActive`:** `23.5s`
- **Rootfs Mount:** `/dev/wda on /arch type ext4 (rw,noatime)` (`UUID=2de12b0d-95e2-4370-aabd-29606fdfc918`)
- **Persistent Home Mount:** `/dev/wdb on /arch/root type ext4 (rw,noatime)` (`home-arch-kde`)
- **Memory Usage (Plasma 6.8.3 + Konsole + Dolphin + KIO workers):** `1026 MiB` used / `2009 MiB` total (`753 MiB` free, `1007 MiB` available)
- **Active Processes:** `dbus-daemon` (system & session), `plasmashell --no-respawn`, `konsole`, `dolphin`, `kioworker` (`tags`, `desktop`, `trash`, `thumbnail`), `gpuserver`, `wlserver`
- **Warm Reboot:** `33.9s` (`ext4` mounted cleanly with zero `EXT4-fs error` messages after `shutdown()` `killall -9` + `sync` fix in `WasmLinuxAdapter.ts`).
