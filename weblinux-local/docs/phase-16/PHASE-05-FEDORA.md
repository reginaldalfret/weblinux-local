# Phase 16: Fedora 45 KDE Plasma Branding

## Overview
- **Distribution ID:** `fedora-kde`
- **Upstream Release:** Fedora Linux 45 `riscv64`
- **Desktop Environment:** KDE Plasma 6 (`org.fedoraproject.fedora.desktop`, `f45-backgrounds-kde`)
- **Script:** `scripts/branding/apply-fedora-branding.sh`
- **Trust Policy:** `gpgcheck=1` preserved in `/etc/dnf/repos.override.d/99-weblinux-security.repo` with `RPM-GPG-KEY-fedora-45-primary`; zero unsigned RPMs installed.

## Asset Provenance & Checksums
Sourced from installed Fedora 45 packages (`fedora-logos`, `f45-backgrounds-kde`, `plasma-lookandfeel-fedora`):
- `wallpaper.png` — SHA-256: `AE18C352B30C75C733D5240295C6DA23A7E7A417529A894984469DD41F251097`
- `wallpaper.webp` — SHA-256: `39338DF723CC742E7C43AB2CDA65820628313A121017599497525BCC969861AF`
- `wallpaper-night.png` — SHA-256: `566281E30FC4B9BBC6BC4B02DEB8D70039B6E9F6016D47B8838184F3165ABB58`
- `wallpaper-night.webp` — SHA-256: `E03D5C2ACF9146CEB5FB1A79D297AABD0EEA4FCCD463AF074B06C788B28FC8C1`
- `fedora-logo.svg` — SHA-256: `1F8AA21E5D4171AB5263758252054BAE21E546F9C26683F0E37F2EACE9E3E394`
- `fedora-whitelogo.svg` — SHA-256: `0001B1561DEA52116AE65A603FA1008D18FC1BB1BB6FD7FAC595BE28AF52B746`
- `fedora-logo-icon.png` — SHA-256: `53EF2B42C902084DF98C495C9864584CBCFFE17EE32B33DA8515AF8A2CC64040`
- `start-here.svg` — SHA-256: `2860D8B779E6620FEFFB54D6CBC48A2ACA2B940E25E79E75AA5B4101C44F1D75`

## Applied KDE Customization
- **Color Scheme:** Fedora Blue (`#51A2DA` / `#3C6EB4`) over Breeze Light/Dark
- **Look-and-Feel & Wallpaper:** `org.fedoraproject.fedora.desktop` + `F45` (`f45-01-day.jxl`)
- **Migration:** Idempotent marker `~/.local/state/weblinux/branding-v1-applied`

## Rootfs Packaging & Integrity
- **Total Chunks:** `3328` (`1982` non-zero, `bootChunks: 64`, `3,489,660,928` bytes)
- **Full Image SHA-256:** `14032bea408bbba2377f2ed4a773f4e013252b88c14d0ad160534dcfdb314a39`
- **Graphical Browsers:** None installed (`gpgcheck=1` preserved)
