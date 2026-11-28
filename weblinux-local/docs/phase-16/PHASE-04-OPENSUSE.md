# Phase 16: openSUSE Tumbleweed KDE Plasma 6.8.2 Branding

## Overview
- **Distribution ID:** `opensuse-tumbleweed-kde`
- **Upstream Release:** openSUSE Tumbleweed `riscv64` (`Snapshot20261106`)
- **Desktop Environment:** KDE Plasma `6.8.2` (`org.openSUSE.desktop`)
- **Script:** `scripts/branding/apply-opensuse-branding.sh`
- **Trust Policy:** Zypper/RPM GPG checks preserved (`Yes` on all enabled repos), `MozillaFirefox` removed (`-286.1 MiB`), zero graphical browsers installed.

## Asset Provenance & Checksums
Official openSUSE Tumbleweed / Geeko branding assets:
- `logo-geeko.svg` — SHA-256: `7DDF32C120E675C7865C4F021D3E379BE615DA044DC7CA997B3F1BD4FD61B06E`
- `logo-square.svg` — SHA-256: `7DDF32C120E675C7865C4F021D3E379BE615DA044DC7CA997B3F1BD4FD61B06E`
- `logo-tumbleweed.svg` — SHA-256: `7DDF32C120E675C7865C4F021D3E379BE615DA044DC7CA997B3F1BD4FD61B06E`
- `logo-tumbleweed.png` — SHA-256: `D85EEB4F1021DF977173D0533CB1FA5B232BFAAFA1C8C04652719E44B4C5662B`
- `wallpaper.png` — SHA-256: `54E58B41592FA7D96AEC9910AB0AB19006661E8AD9F7B98F1B713AE9F192BD87`
- `wallpaper-dark.png` — SHA-256: `BEF2785265E5B6F7DF7328938266B4DC9790C99D3FF804C12A72A86204AB35AF`

## Applied KDE Customization
- **Look-and-Feel & Plasma Theme:** `org.openSUSE.desktop`, `PlasmaTheme=openSUSE`
- **Color Scheme & Accent:** `ColorScheme=openSUSE`, `AccentColor=115,186,37` (`#73BA25` Geeko Green)
- **Icons & Cursor:** `breeze` / `breeze_cursors`
- **Konsole:** `openSUSE-Tumbleweed.profile`
- **Migration:** Idempotent marker `~/.local/state/weblinux/branding-v1-applied` (`version=v1`, `distro=opensuse-tumbleweed`)

## Rootfs Packaging & Integrity
- **e2fsck -fy:** Clean (`108514/360448 files, 1012788/1441792 blocks`)
- **Total Chunks:** `5632` (`4127` non-zero, `bootChunks: 64`)
- **Full Image SHA-256:** `9fe503c79d9d1011b41c8864bdfc0196acc7bd2b4c73b122424e4f0666050323`
- **Graphical Browsers:** None installed
