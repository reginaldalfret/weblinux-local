# Ubuntu 24.04.5 LTS KDE Plasma 5.27 Qualification Report (Phase 6.5)

**Qualification Status:** `UBUNTU KDE PARTIALLY VALIDATED` (Visibly Rendering & Interactive in Microsoft Edge; `validationStatus: "experimental"`)

## 1. Executive Summary

Using the Debian 13 KDE (`wlserver` in `WLSERVER_SHELL=plasma` mode) architecture as the reference baseline, we assembled an isolated, authentic **Ubuntu 24.04.5 LTS (Noble Numbat) KDE Plasma 5.27.12 LTS** `riscv64` root filesystem (`1.3 GiB` across `743` Canonical `.deb` packages) packaged into a `3.0 GiB` `ext4` image (`3,072` x `1 MiB` chunks, `1,326` non-zero, `51` boot chunks).

In live Microsoft Edge (`msedge`) testing under the existing WebAssembly64 NOMMU Linux 6.6.0 kernel and `/bin/rv` interpreter (`2048 MiB` guest RAM):
- **Boot & Compositor:** `ubuntu-kde` supervisor (`/bin/ubuntu-kde`) + `/usr/local/bin/ubuntu-kde-session` started D-Bus (system + session), `kbuildsycoca5`, and `wlserver` (`WLSERVER_SHELL=plasma`, `wayland-0`) in **27–31s**.
- **Plasma Desktop Rendering:** `plasmashell 5.27.12 --no-respawn` mapped both the Desktop window (`Desktop @ QRect(0,0 1600x896) — Plasma`) and the Plasma Panel (`1600x44`) and rendered the **KDE Breeze mountain wallpaper** visibly on `<canvas id="screen">` after **~85s** (once `splash.js` was updated to recognize Plasma 5.27's `xdg_toplevel` `kind === 1` desktop surface in addition to Plasma 6's `zwlr_layer_shell_v1` `kind === 6`).
- **Native KDE Applications:** **Konsole 23.08.5** (`root@ubuntu-noble:/#`) and **Dolphin 23.08.5** (`Home — Dolphin`) launched on `wayland-0` with Breeze window decorations and rendered cleanly over the Plasma desktop. Keyboard input into Konsole was verified live.
- **OPFS Storage Persistence:** Writing `/ubuntu/root/kde-verified.txt` on `/dev/wdb` (`15.8 GiB`) succeeded alongside `/dev/wda` (`2.9 GiB`, `45%` used).

## 2. Ubuntu GNOME 46 vs. Ubuntu KDE Plasma 5.27 Comparison

| Metric / Capability | Ubuntu GNOME 46 (Phase 6.4) | Ubuntu KDE Plasma 5.27 (Phase 6.5) |
|---|---|---|
| **Source Packages** | Authentic Ubuntu Noble `riscv64` (`gnome-shell 46.0`, `mutter 46.2`, `gjs 1.80.2`) | Authentic Ubuntu Noble `riscv64` (`743` `.deb`s: `plasmashell 5.27.12`, `konsole 23.08.5`, `dolphin 23.08.5`, `kwin 5.27.11`) |
| **Rootfs Disk Image** | `3.0 GiB` `ext4` (`/disk/ubuntu-24.04-gnome/`) | `3.0 GiB` `ext4` (`/disk/ubuntu-24.04-kde/`) |
| **Display / Compositor** | Nested `mutter 46.2` (`llvmpipe` + SpiderMonkey `JS_DISABLE_JIT=1`) | `wlserver` (`WLSERVER_SHELL=plasma`) + `QT_QUICK_BACKEND=software` (`QMLSCENE_DEVICE=softwarecontext`) |
| **First Visible Frame** | Did not complete within 65+s | **~85s** (Breeze splash -> Plasma 5.27 Breeze wallpaper) |
| **Resident Memory (`free -m`)** | ~442 MiB (`gnome-shell` alone) | **~491 MiB total guest used** (`plasmashell` + `dbus` + `wlserver`) |
| **Interactive Apps Verified** | Blocked before first desktop frame | **Konsole 23.08.5** (interactive shell) + **Dolphin 23.08.5** |
| **Status** | `experimental` | `experimental` (`UBUNTU KDE PARTIALLY VALIDATED`) |

## 3. Root Causes Diagnosed & Fixed During Phase 6.5

1. **Plasma 5.27 Splash Dismissal (`apps/web/public/splash.js`, `runtime/splash.js`):**
   - `splash.js` previously only dismissed the Breeze splash overlay when `w.kind === 6 && w.layer === 0` (`zwlr_layer_shell_v1`, used by Plasma 6). Plasma 5.27 uses `org_kde_plasma_shell` on `xdg_toplevel` (`w.kind === 1`, title `Desktop @ ...`), which left the opaque splash overlay hiding the rendered desktop. Adding `w.kind === 1 && (w.role === 1 || (w.title && w.title.startsWith("Desktop @")))` resolved this.
2. **Supervisor Argument Forwarding (`initramfs-staging/bin/ubuntu-kde`):**
   - Changed `exec /bin/ubuntu "$*"` to `exec /bin/ubuntu "$@"` so multi-argument commands pass cleanly.
3. **Desktop Selector Notice (`apps/web/src/pages/DesktopSelector.tsx`):**
   - Fixed the non-validated card branch so `ubuntu-kde` displays its own experimental note rather than the Debian 13 availability blocker message.

## 4. Remaining Caveats (Why `PARTIALLY VALIDATED`)

1. **Viewport Auto-Resize:** `display.js` / `Desktop.tsx` resized the canvas container to `1600x1376` inside a `1600x950` viewport, placing the `44px` bottom Plasma panel below the initial fold without scrolling.
2. **First-Boot QML Software Compilation:** Initial `plasmashell` startup takes ~85s under RISC-V NOMMU `/bin/rv` while building QML/Breeze caches (`theme 1..11`).
3. **UDisks2 / Polkit Warnings:** Expected in chroot NOMMU without `systemd`/`udisks2` daemon (`Failed enumerating UDisks2 objects`); non-fatal to desktop, Konsole, and Dolphin.

## 5. Verification Evidence

- Regression Suite: `node tests/phase6-ubuntu/run-all-tests.js` (11/11 suites).
- Production Build: `npm run build` in `apps/web` (`tsc && vite build`).
- Live Edge Artifacts (`tests/screenshots/phase6-kde/`):
  - `01-ubuntu-kde-selector.png`
  - `02-ubuntu-kde-booting.png`
  - `04-ubuntu-kde-konsole.png` (live Konsole 23.08.5 with keyboard input)
  - `05-ubuntu-kde-dolphin.png` (live Dolphin 23.08.5 + Konsole 23.08.5 over Breeze wallpaper)
