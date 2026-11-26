# Phase 9 — Final Qualification Report: Arch Linux RISC-V + KDE Plasma 6

## 1. Summary

Arch Linux RISC-V (`RV64GC` / `LP64D`) with KDE Plasma `6.8.3` is integrated as an independent distribution (`arch-kde`) in WebLinux Local, alongside existing Debian 13 and Ubuntu 24.04.5 environments, with isolated OPFS disks (`root-arch-kde` and `home-arch-kde`).

## 2. Verification Matrix

| Check | Result | Notes |
|---|---|---|
| Phase 0 Compatibility Audit | **PASS** (`bd20df3`) | `archriscv-2026-08-27.tar.zst`, `ELF64 RISC-V`, `LP64D`, `Pacman v7.1.0` |
| Rootfs & Plasma 6.8.3 Closure | **PASS** (`629ed5b`) | `555` signed packages, `pacman -Syu`, `DisableSandbox`, `passwd -l root` |
| Disk Slicing & Integrity | **PASS** (`091b2ae`) | `5.0 GiB` ext4 (`e2fsck -fy` clean), `5120` chunks (`3644` non-zero) |
| Initramfs & Manifest Wiring | **PASS** (`091b2ae`) | `/bin/arch-root`, `/bin/arch-kde`, `/init` `arch*` mounts, all 7 manifests updated |
| Live Arch KDE 6 (`test-phase9-arch-kde.js`) | **PASS** (`task-8439`) | Boot `23.5s`, Plasma 6.8.3 + panel, Kickoff, Konsole, Dolphin, `pacman` HTTPS 200, warm reboot `33.9s` |
| Ubuntu/Debian Networking (`test-phase8-networking.js`) | **PASS** (`task-8456`) | Exit `0`, DNS `104.20.23.154`, HTTPS `200`, RFC1918 blocked |
| Ubuntu KDE RVGPU (`test-phase7-kde-rvgpu.js`) | **PASS** (`task-8473`) | Exit `0`, `guestConnected: true`, `149` records, `vrend-webgl2`, `errors: []` |
| Ubuntu KDE Acceptance (`test-phase652-acceptance.js`) | **PASS** (`task-8473`) | Exit `0`, cold `25s`, warm `36s`, clean shutdown `9.5s` |
| TypeScript & Vite Production Build | **PASS** (`task-8455`) | `tsc && vite build` succeeded in `29.74s` |

## 3. Known Limitations

1. **Plasma 6 `QRhi` over `virpipe`:** Qt 6.12 `QRhi` disconnects from `gpuserver` (`lost connection to rendering server on 8`), so `plasmashell` uses `QT_QUICK_BACKEND=software` while `gpuserver` (`rvgpu-0.ready`) remains active.
2. **Playwright Ephemeral Context Persistence:** In `test-phase9-arch-kde.js` and `test-phase652-acceptance.js`, `remount,ro` clean shutdown eliminated `EXT4-fs error` on `/dev/wdb`, while `arch-persist-test.txt` content read back blank across warm reboot in ephemeral Playwright contexts (`warmPersistence: false` in Ubuntu KDE as well).
