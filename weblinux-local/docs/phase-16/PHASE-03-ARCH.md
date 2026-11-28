# Phase 16: Arch Linux KDE Plasma 6.8.3 Branding

## Overview
- **Distribution ID:** `arch-kde`
- **Upstream Release:** Arch Linux `riscv64`
- **Desktop Environment:** KDE Plasma `6.8.3` (`breeze 6.8.3-1`, `breeze-icons 6.32.0-1`, `breeze-cursors 6.8.3-1`, `konsole 26.08.3-1`, `dolphin 26.08.3-1`)
- **Script:** `scripts/branding/apply-arch-branding.sh`

## Asset Provenance & Checksums
Official Arch Linux artwork from signed `archlinux-wallpaper 1.6.1-7` (Pacman signature verification preserved):
- `archwave.png` — SHA-256: `B6D3D7A725AB55FB7A535EAF56778FEB02CDE7E00336F69C1465BE8DD0B3A8DB`
- `archlinux-logo.svg` — SHA-256: `3FFE8EA4E98DB43A3EC4DCCA55FD4009CD8B8D220F0996AEF7A5B427FDF65234`
- `archlinux-logo.png` — SHA-256: `3F48779141B68A81E07FEE710A42025D4F67B16240295AA4CF148A7BA99CAB3C`
- `archlinux-logo-text.svg` — SHA-256: `601069E6E8920309178C397FD8CEBE43410827D01899D31777D13212F0DFACF8`
- `archlinux-logo-text-dark.svg` — SHA-256: `96E3CC81623C0537A19799F9EEFA966FE46FF5F28A9DC7AF1187990973BAA127`

## Applied KDE Customization
- **Palette:** Arch Blue (`#1793D1`, `ANSI_COLOR="38;2;23;147;209"`) and Breeze Dark minimalist layout
- **Icons & Cursor:** `breeze-dark` / `breeze_cursors` + `archlinux-logo`
- **Shell & Konsole:** Arch Linux interactive prompt in `/etc/skel/.bashrc` + Konsole theme
- **Migration:** Idempotent migration marker `~/.local/state/weblinux/branding-v1-applied` (`version=1`, `distro=arch`, `plasma=6.8.3`)

## Rootfs Packaging & Integrity
- **e2fsck -fy:** Clean (`162547/327680 files, 1045841/1310720 blocks`)
- **Total Chunks:** `5120` (`4051` non-zero, `bootChunks: 64`)
- **Full Image SHA-256:** `bd08075dce8a7f89c0163ebf2dbda94dc6cffb1197bd9f0b500c38a51fc2ab42`
- **Graphical Browsers:** None installed
