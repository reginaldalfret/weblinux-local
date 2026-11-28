# Phase 16: Visual Qualification Report

## Qualification Method
Live Microsoft Edge (`launchPersistentContext`, preserving OPFS without `resetAll()` or `freshHomeDisk`) executing `tests/test-phase16-branding.js <distroId>` against the local Vite server (`http://localhost:3000`) and guest network relay (`ws://127.0.0.1:8081`).

## Per-Distribution Visual Results

| Distribution | Status | Observed Visual Evidence |
|---|---|---|
| **Debian 13 KDE (`debian-firefox`)** | **PASS** | `p16-debian-firefox-01-desktop.png`..`06-rebooted-desktop.png`: Official Debian 13 Trixie Ceratopsian blue wave wallpaper with Debian swirl, crimson folder icon, Konsole showing `PRETTY_NAME="Debian GNU/Linux 13 (trixie)"` and `branding-v1-applied`, Kickoff, Dolphin, System Settings, and rebooted desktop all verified. |
| **Fedora 45 KDE (`fedora-kde`)** | **PASS** | `p16-fedora-kde-01-desktop.png`..`06-rebooted-desktop.png`: Official Fedora 45 (`F45`) wallpaper, Fedora `f` Kickoff logo, `#51A2DA` Fedora Blue selection highlights, Konsole, Dolphin, System Settings, and rebooted desktop all verified. |
| **Arch Linux KDE (`arch-kde`)** | **PASS WITH LIMITATION** | `p16-arch-kde-01-desktop.png`..`06-rebooted-desktop.png`: Blue Arch Linux Kickoff logo + `"Arch Linux"` panel label, `ArchBreezeDark` + `#1793D1` accent, Konsole, Dolphin, System Settings, and rebooted desktop verified. Existing OPFS `plasma-org.kde.plasma.desktop-appletsrc` retained user's prior wallpaper per non-destructive migration policy; `pacman -Q` emitted ANSI cursor codes with zero browser packages found. |
| **openSUSE Tumbleweed KDE (`opensuse-tumbleweed-kde`)** | **PASS WITH LIMITATION** | `p16-opensuse-tumbleweed-kde-01-desktop.png`..`06-rebooted-desktop.png`: Authentic openSUSE Tumbleweed green/teal geometric wallpaper, Geeko chameleon Kickoff icon, Konsole showing `PRETTY_NAME="openSUSE Tumbleweed"` and `branding-v1-applied`, Dolphin, System Settings, and rebooted desktop verified. Initial `01-desktop.png` at 145s was captured before first compositor frame; desktop rendered cleanly by `02-kickoff`..`06-rebooted-desktop`. |
| **Ubuntu 24.04.5 KDE (`ubuntu-kde-epiphany`)** | **PASS WITH LIMITATION** | `p16-ubuntu-kde-epiphany-01-desktop.png` captured authentic Ubuntu Noble Numbat purple/orange crown wallpaper (`Uptime: 1m 33s`, `OPFS ext4: RW`, `Relay Active`) with Plasma 5.27.12 preserved. Guest later hit transient `/bin/rv` Wasm `Kernel panic: BUG! Trying to stop secondary cpu with ID 0` during extended UI automation. |
| **Alpine 3.24.4 KDE (`alpine-kde`)** | **PASS WITH LIMITATION** | Chroot verification confirmed `NAME="Alpine Linux"`, `VERSION_ID=3.24.4`, Plasma `6.6.6`, `e2fsck -fy` clean, `NO_BROWSERS_OK`, and live Edge cold boot succeeded in `33.1s` (`p16-alpine-kde-01-desktop.png`, `02-kickoff.png`), though Plasma compositor had not drawn a frame before `runGuest` stalled at Konsole launch. |
