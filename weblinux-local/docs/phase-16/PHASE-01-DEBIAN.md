# Phase 16: Debian 13 (Trixie) KDE Plasma Branding

## Overview
- **Distribution ID:** `debian-firefox` (branding profile `debian-kde`)
- **Upstream Release:** Debian GNU/Linux 13 (Trixie) `riscv64`
- **Desktop Environment:** KDE Plasma 6 (Breeze base + Debian Ceratopsian theme)
- **Script:** `scripts/branding/apply-debian-branding.sh`

## Asset Provenance & Checksums
Assets extracted from official Debian `desktop-base` (`Ceratopsian` Trixie theme) with APT GPG verification preserved:
- `ceratopsian-1920x1080.svg` — SHA-256: `F39DBE2D0C9F3931CCC148D82767736394C1EB92518166CE24293E83E7686B05`
- `debian-emblem-symbolic.svg` — SHA-256: `FB6315996EF9D81949E26F4E44B125B8197BB5CBD071E02A790E4FC8A17D5413`
- `debian-logo-text-version.svg` — SHA-256: `74AC444FE77B51A9E039EC45B470607DA2CA8628A3F4063FA23F9E10D5FD5148`
- `debian-swirl-256.png` — SHA-256: `29EF197311549B3AAAC9C444D10C2636AF81FB72A5B9EB6871A447AD7DBDD9BC`
- `debian-swirl-64.png` — SHA-256: `F9D54D8B7101330F242D21537AD1C707EAE6140E286BDA9D9051472D7EB295E5`
- `debian-swirl.svg` — SHA-256: `25B50A88D9669370E5D0E37B3996B26AB710BF35860D711C1FC26A47E6786599`

## Applied KDE Customization
- **Color Scheme:** `DebianTrixieDark` (`#A80030` / `#D70A53` Debian Crimson accents on Breeze Dark)
- **Icons & Cursor:** `breeze-dark` / `breeze_cursors` + Debian swirl launcher icon
- **Konsole Profile:** `DebianTrixie` (`BidiRenderingEnabled=false`)
- **Migration:** Idempotent `/usr/local/bin/weblinux-apply-debian-branding` using `~/.local/state/weblinux/branding-v1-applied`

## Rootfs Packaging & Integrity
- **Disk ID:** `debian-13-firefox`
- **Total Chunks:** `8192` (`8,589,934,592` bytes, `1 MiB` pieces)
- **Non-Zero Chunks:** `4506` (`bootChunks: 64`)
- **Full Image SHA-256:** `66164a03fa59724e5d17d8c975705fb2f04ab2fde0e20265f379a7c443f4e5e1`
- **Graphical Browsers:** None installed (Phase 15 browser-free policy preserved)
