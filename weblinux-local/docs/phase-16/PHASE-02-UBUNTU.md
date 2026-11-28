# Phase 16 — Agent 2: Ubuntu 24.04.5 LTS KDE Branding

## Summary

Applied authentic **Ubuntu 24.04.5 LTS (Noble Numbat)** KDE Plasma 5.27.12 branding to the `ubuntu-24.04-kde-epiphany` RISC-V 64 rootfs image while preserving Plasma 5.27.12, `/etc/os-release`, package signature verification (`ubuntu-archive-keyring.gpg`), and user data.

- **Automation Script**: `scripts/branding/apply-ubuntu-branding.sh`
- **Staged Assets**:
  - `apps/web/public/branding/ubuntu/`
  - `D:\weblinux-disks\branding\ubuntu\`
- **Target Disk ID**: `ubuntu-24.04-kde-epiphany` (preserved)

---

## Environment & Preserved Versions

Verified inside `chroot /root/branding-ubuntu/mnt /usr/bin/qemu-riscv64-static`:

- **OS Release (`/etc/os-release`)**:
  - `PRETTY_NAME="Ubuntu 24.04.5 LTS"`
  - `VERSION="24.04.5 LTS (Noble Numbat)"`
- **KDE Plasma & Applications (`dpkg-query` / `plasmashell`)**:
  - `plasmashell --version` (`QT_QPA_PLATFORM=offscreen`): `plasmashell 5.27.12`
  - `plasma-desktop`: `4:5.27.12-0ubuntu0.1`
  - `plasma-workspace`: `4:5.27.12-0ubuntu0.1`
  - `breeze`: `4:5.27.12-0ubuntu0.1`
  - `breeze-cursor-theme`: `4:5.27.12-0ubuntu0.1`
  - `breeze-icon-theme`: `4:5.115.0-0ubuntu3`
  - `kwin-wayland`: `4:5.27.11-0ubuntu3`
  - `dolphin`: `4:23.08.5-0ubuntu4`
  - `konsole`: `4:23.08.5-0ubuntu4`
- **Browsers**: None installed (`epiphany-browser`, `firefox`, `chromium` absent).

---

## Asset Sources, Licenses & SHA-256 Checksums

### Upstream Sources

1. **Noble Numbat Wallpapers** (`warty-final-ubuntu.png`, `ubuntu-wallpaper-d.png`):
   - Source package: `ubuntu-wallpapers_24.04.2_all.deb` from `https://ports.ubuntu.com/ubuntu-ports/pool/main/u/ubuntu-wallpapers/ubuntu-wallpapers_24.04.2_all.deb` (SHA-256: `092f4cdcbb1c0c0bfa03c7f2b31d7a1863b8c36e4ee9efcb522b4a7332f78eba`)
   - Resolution: `3840 x 2160` PNG (`8-bit/color RGB, non-interlaced`)
   - Copyright / License: `Copyright: 2016-2022 Canonical Ltd`, `License: CC-BY-SA-4.0` (per `/usr/share/doc/ubuntu-wallpapers/copyright`)
2. **Official Ubuntu Logo & Wordmarks** (`ubuntu-logo.svg`, `ubuntu-logo-text.png`, `ubuntu-logo-text-dark.png`):
   - Source: `/usr/share/pixmaps/` inside the Ubuntu 24.04.5 LTS rootfs (`ubuntu-logo.svg` uses Canonical Orange `#e95420` and white Circle of Friends).

### Staged Asset Checksums

Verified in both `apps/web/public/branding/ubuntu/` and `D:\weblinux-disks\branding\ubuntu\`:

| File | SHA-256 |
| --- | --- |
| `warty-final-ubuntu.png` | `75e190117dd5f5fa1dc5f51dd06b4d48624144266fccda945a9634b4165ffdbc` |
| `ubuntu-wallpaper-d.png` | `c1ebcddff3b2aefb4a0b24831d855567b0c0693089c291ff04e006f59599fc74` |
| `ubuntu-logo.svg` | `c77bcc07ef8a37e276e4b555ace73fae7608e3b72760368268265af4e027915d` |
| `ubuntu-logo-text.png` | `26deac685457e38325d743c50ff3d7b83a820243afef26878c13ee262198528c` |
| `ubuntu-logo-text-dark.png` | `2d6f9e55acdc9583bb2d7533e5aff0947252eaddc0734cdceeb58e38713925f3` |

---

## Branding Configuration Applied Inside Guest Rootfs

1. **Wallpaper & Plasma 5 Wallpaper Package**:
   - `/usr/share/backgrounds/warty-final-ubuntu.png`
   - `/usr/share/backgrounds/ubuntu-wallpaper-d.png`
   - `/usr/share/wallpapers/UbuntuNoble/{metadata.json,contents/images/3840x2160.png,contents/images_dark/3840x2160.png,contents/screenshot.png}`
2. **Ubuntu Noble Color Scheme (`/usr/share/color-schemes/UbuntuNoble.colors`)**:
   - Breeze-based dark aubergine & orange palette:
     - Ubuntu Orange `#E95420` (`233,84,32`) for `AccentColor`, `DecorationFocus`, and active selection
     - Canonical Aubergine `#77216F` (`119,33,111`) for `DecorationHover` and alternate accents
     - Dark Aubergine `#2C001E` (`44,0,30`) for `[Colors:Header]`, `[WM] activeBackground`, and complementary surfaces
3. **Plasma 5 Look-and-Feel (`/usr/share/plasma/look-and-feel/org.ubuntu.noble.desktop/`)**:
   - Configures `ColorScheme=UbuntuNoble`, `Icons Theme=breeze-dark`, `plasmarc Theme=breeze-dark`, `Wallpaper Image=UbuntuNoble`, `cursorTheme=breeze_cursors`, and `org.kde.breeze` window decorations.
   - `contents/layouts/org.kde.plasma.desktop-layout.js` sets `org.kde.image` wallpaper to `/usr/share/wallpapers/UbuntuNoble/contents/images/3840x2160.png` and configures `org.kde.plasma.kickoff` with `icon=start-here-ubuntu`, `menuLabel=Ubuntu`, and `favorites=org.kde.konsole.desktop,org.kde.dolphin.desktop,systemsettings.desktop`.
4. **Icons**:
   - Installed `start-here-ubuntu.svg` in `/usr/share/icons/hicolor/scalable/places/` and `/usr/share/icons/breeze-dark/places/22/`.
5. **Konsole Profile & Colors**:
   - `/usr/share/konsole/UbuntuNoble.colorscheme` (`#2C001E` background, `#FFFFFF` foreground, `#E95420` intense foreground, `#77216F` color5)
   - `/usr/share/konsole/UbuntuNoble.profile` (`ColorScheme=UbuntuNoble`, `Font=DejaVu Sans Mono,11,-1,5,50,0,0,0,0,0`)
6. **System-wide XDG Defaults & Dolphin Styling**:
   - `/etc/xdg/kdeglobals`, `/etc/xdg/konsolerc`, `/etc/xdg/dolphinrc` (`ShowFullPath=true`, `MenuBar=Disabled`), `/etc/xdg/kcminputrc`, `/etc/xdg/plasmarc`, `/etc/xdg/kwinrc`.
7. **Idempotent Migration & Interactive Shell Prompt**:
   - `/usr/local/bin/weblinux-apply-branding` + `/etc/xdg/autostart/weblinux-branding.desktop`: checks `~/.local/state/weblinux/branding-v1-applied`, backs up any existing user configs to `~/.local/state/weblinux/backup-branding-v1/`, applies settings via `kwriteconfig5`, and writes the marker without deleting `.config` or user data.
   - `/etc/profile.d/weblinux-ubuntu-prompt.sh`: guarded with `case $- in *i*) ;; *) return 0 2>/dev/null || exit 0 ;; esac` so non-interactive scripts are unaffected.

---

## Verification & Disk Image Integrity

- **Chroot Verification**:
  - `plasmashell 5.27.12` preserved.
  - `/etc/os-release` intact (`Ubuntu 24.04.5 LTS`).
  - Idempotent migration executed twice for `HOME=/root`; `/root/.local/state/weblinux/branding-v1-applied` present.
  - Wallpaper, color scheme, Konsole profile, and `start-here-ubuntu.svg` verified present.
  - Non-interactive `bash -c "source /etc/profile.d/weblinux-ubuntu-prompt.sh; echo non-interactive-ok"` exited `0`.
- **Filesystem Check (`e2fsck -fy`)**:
  - `ubuntu-kde: 77496/229376 files (0.2% non-contiguous), 426421/917504 blocks`
- **Chunk Re-slicing & Round-Trip Verification**:
  - Output synced to `/mnt/d/weblinux-disks/ubuntu-24.04-kde-epiphany` and `/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/ubuntu-24.04-kde-epiphany`:
  - `distributionId`: `ubuntu-24.04-kde-epiphany`
  - `totalChunks`: `3584`
  - `nonZeroChunks`: `1892`
  - `bootChunks`: `52`
  - `imageSizeBytes`: `3758096384`
  - `pieceSizeBytes`: `1048576`
  - `fullImageSha256`: `a37cf7ae622761048399284451206b82505b515fb18275388f84f87fe1a8b2dc`
  - `manifest.id`: `a37cf7ae622761048399284451206b82`
  - `RECONSTRUCT_OK=True`
