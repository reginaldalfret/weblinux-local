# Ubuntu 24.04.5 LTS KDE Plasma 5.27 Qualification Report (Phase 6.5 / 6.5.1)

**Qualification Status:** `UBUNTU KDE PARTIALLY VALIDATED` (`validationStatus: "experimental"`)

## 1. Executive Summary

Using the Debian 13 KDE (`wlserver` in `WLSERVER_SHELL=plasma` mode) architecture as the reference baseline, we assembled an isolated, authentic **Ubuntu 24.04.5 LTS (Noble Numbat) KDE Plasma 5.27.12 LTS** `riscv64` root filesystem (`1.3 GiB` across `743` Canonical `.deb` packages) packaged into a `3.0 GiB` `ext4` image (`3,072` x `1 MiB` chunks, `1,326` non-zero, `51` boot chunks).

Across Phase 6.5 and Phase 6.5.1 live Microsoft Edge (`msedge`) qualification under the WebAssembly64 NOMMU Linux 6.6.0 kernel and `/bin/rv` interpreter (`2048 MiB` guest RAM):
- **Boot & Compositor:** `ubuntu-kde` supervisor (`/bin/ubuntu-kde`) + `/usr/local/bin/ubuntu-kde-session` started D-Bus (system + session), `kbuildsycoca5`, and `wlserver` (`WLSERVER_SHELL=plasma`, `wayland-0`) in **27–35s**.
- **Plasma Desktop & Applications:** `plasmashell 5.27.12 --no-respawn` mapped both the Desktop window (`Desktop @ QRect(0,0 1600x896) — Plasma`) and Plasma Panel (`Plasma`, `1600x44`) and rendered the Breeze mountain wallpaper visibly on `<canvas id="screen">`. **Konsole 23.08.5** (`root@ubuntu-noble:/#`) and **Dolphin 23.08.5** (`Home — Dolphin`) launched on `wayland-0`.
- **Interactive Input & Pointer Lock:** Mouse click into Konsole and live keyboard typing (`echo phase651-konsole-ok; uname -m` -> `phase651-konsole-ok`, `riscv64`) executed cleanly. `Escape` + `document.exitPointerLock()` released Pointer Lock (`document.pointerLockElement === null`), allowing a normal (non-forced) Playwright click on `Power Off` to succeed.
- **Shutdown, Lock Release & Reboot Persistence:** Clicking `Power Off` transitioned `weblinuxAdapter.status.state` to `stopped` in `1s`, released all OPFS Web Locks (`navigator.locks.query()` -> `held: 0, pending: 0`), and preserved `/ubuntu/root/phase651-persist.txt` (`PHASE_6_5_1_PERSIST_1795592806404`) across a full Ubuntu KDE reboot.
- **Cross-Distribution Isolation:** Verified Ubuntu CLI (`/dev/wda` `1.9G`, `Ubuntu 24.04.5 LTS`), Debian 13 KDE (`/dev/wda` `7.8G`, `Debian GNU/Linux 13 (trixie)`, `ISOLATED_OK` with no Ubuntu persistence file), and Ubuntu GNOME/KDE/CLI profile availability (`KDE=true, GNOME=true, CLI=true`).

## 2. Ubuntu GNOME 46 vs. Ubuntu KDE Plasma 5.27 Comparison

| Metric / Capability | Ubuntu GNOME 46 (Phase 6.4) | Ubuntu KDE Plasma 5.27 (Phase 6.5 / 6.5.1) |
|---|---|---|
| **Source Packages** | Authentic Ubuntu Noble `riscv64` (`gnome-shell 46.0`, `mutter 46.2`, `gjs 1.80.2`) | Authentic Ubuntu Noble `riscv64` (`743` `.deb`s: `plasmashell 5.27.12`, `konsole 23.08.5`, `dolphin 23.08.5`, `kwin 5.27.11`) |
| **Rootfs Disk Image** | `3.0 GiB` `ext4` (`/disk/ubuntu-24.04-gnome/`) | `3.0 GiB` `ext4` (`/disk/ubuntu-24.04-kde/`) |
| **Display / Compositor** | Nested `mutter 46.2` (`llvmpipe` + SpiderMonkey `JS_DISABLE_JIT=1`) | `wlserver` (`WLSERVER_SHELL=plasma`) + `QT_QUICK_BACKEND=software` (`QMLSCENE_DEVICE=softwarecontext`) |
| **First Visible Frame** | Did not complete within 65+s | **~85–151s** (Breeze splash -> Plasma 5.27 Breeze wallpaper) |
| **Resident Memory (`free -m`)** | ~442 MiB (`gnome-shell` alone) | **~491 MiB total guest used** (`plasmashell` + `dbus` + `wlserver`) |
| **Interactive Apps Verified** | Blocked before first desktop frame | **Konsole 23.08.5** (interactive shell) + **Dolphin 23.08.5** |
| **Shutdown & OPFS Reboot** | Not reached graphically | **`stopped` in 1s, `0` held locks, OPFS persistence verified** |
| **Status** | `experimental` | `experimental` (`UBUNTU KDE PARTIALLY VALIDATED`) |

## 3. Incomplete Items Preventing `FULLY VALIDATED`

1. **Bottom Panel & Application Launcher Visibility (`1600x950` viewport):** Although `wlserver` mapped the `1600x44` `Plasma` panel window, `canvas.clientHeight` expanded to `1312px` inside the `1600x950` viewport, placing the bottom panel below the fold so the Kickoff Application Launcher click at `y=930` missed the panel (`p651-02-app-launcher.png`).
2. **Window Move/Resize Visual Verification:** Dolphin (`05-ubuntu-kde-dolphin.png`) rendered cleanly in Phase 6.5, but did not map within the 30s polling window during `p651-04-dolphin-moved.png`, leaving interactive window drag/resize unverified visually.

## 4. Verification Evidence

- Regression Suite: `node tests/phase6-ubuntu/run-all-tests.js` (**11/11** suites passed).
- Production Build: `npm run build` in `apps/web` (`tsc && vite build`).
- Live Edge Test Logs & Screenshots (`tests/screenshots/phase6-kde/`):
  - `04-ubuntu-kde-konsole.png` & `05-ubuntu-kde-dolphin.png` (Phase 6.5 Konsole & Dolphin rendering)
  - `p651-03-konsole-interactive.png` (Phase 6.5.1 live keyboard input: `echo phase651-konsole-ok; uname -m` -> `riscv64`)
  - `tests/test-live-ubuntu-kde.js` (exit code 0)
  - `tests/test-phase651-kde-final.js` (Phases 2–3 shutdown/lock/reboot persistence verified)
  - `tests/test-phase651-debian-check.js` (Debian 13 KDE & Ubuntu profile isolation verified)
