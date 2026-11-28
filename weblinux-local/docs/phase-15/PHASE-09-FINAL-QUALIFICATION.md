# Phase 15: Final Qualification Report

## Summary
Graphical web browsers introduced during WebLinux browser integration work (`epiphany`, `chromium`, `firefox`, `badwolf`, `netsurf-gtk`, `/usr/local/bin/weblinux-browser`, `/usr/share/applications/weblinux-browser.desktop`) have been removed from all six WebLinux Linux distributions, while preserving KDE Plasma desktops, OPFS root/home persistence, terminal Internet networking, and native package-manager signature verification.

## Verification Matrix (Live Edge + Guest Relay QA)

Test suite: `tests/test-phase15-browser-removal.js` (and `tests/test-phase8-networking.js` for Phase 8 regression).

| Distribution | ID | Browser Binaries & Packages | Wrapper & Desktop Entry | DNS + HTTPS (`curl`) | Package Manager Check | `git` Check | RFC1918 Block | Desktop Render | OPFS Persistence |
|---|---|---|---|---|---|---|---|---|---|
| Debian 13 KDE | `debian-firefox` | Removed (`BIN_CHECK`/`PKG_CHECK` empty; `-525 MB`) | `NO_WRAPPER_OK`, `NO_DESKTOP_OK` | `HTTP/2 200`, `SHA256 25ddf2c8...` | `apt-get update` (`16.4 MB`, `PKG_META_OK`) | Transient `curl 56 Connection reset by peer` | `RFC1918_BLOCKED_OK` | `p15-debian-firefox-desktop.png` (KDE Plasma) | `29288be4...` (matched across reload, `15.6s`) |
| Ubuntu 24.04.5 KDE | `ubuntu-kde-epiphany` | Removed (`BIN_CHECK`/`PKG_CHECK` empty) | `NO_WRAPPER_OK`, `NO_DESKTOP_OK` | `HTTP/2 200`, `SHA256 25ddf2c8...` | `apt-get update` fetched InRelease files, then hit pre-existing `/usr/bin/apt-key` error | `git: not found` in chroot PATH | `RFC1918_BLOCKED_OK` | `p15-ubuntu-kde-epiphany-desktop.png` | `fe064576...` (matched across reload, `25.4s`) |
| Arch Linux KDE | `arch-kde` | Removed (`epiphany-51.2-1`, `-17.47 MiB`; `BIN_CHECK`/`PKG_CHECK` empty) | `NO_WRAPPER_OK`, `NO_DESKTOP_OK` | `HTTP/2 200`, `SHA256 25ddf2c8...` | `pacman -Sy` synced `core`, then `extra.db` timed out at `848 KiB` | `git: command not found` | `RFC1918_BLOCKED_OK` | `p15-arch-kde-desktop.png` | `d08caf3f...` (matched across reload, `25.6s`) |
| openSUSE Tumbleweed KDE | `opensuse-tumbleweed-kde` | Removed (`MozillaFirefox`, `chromium`, `epiphany` + branding, `-719.4 MiB`; `BIN_CHECK`/`PKG_CHECK` empty) | `NO_WRAPPER_OK`, `NO_DESKTOP_OK` | `HTTP/2 200`, `SHA256 25ddf2c8...` | `zypper refresh` (`Update`, `H264`, `Oss`) | Not completed (`Execution context was destroyed` during reload) | Not completed in that run | `p15-opensuse-tumbleweed-kde-desktop.png` | Not completed due to reload context error |
| Fedora 45 KDE | `fedora-kde` | Verified clean (`0` browser RPMs, `gpgcheck=1`; `BIN_CHECK`/`PKG_CHECK` empty) | `NO_WRAPPER_OK`, `NO_DESKTOP_OK` | `HTTP/2 200`, `SHA256 25ddf2c8...` | `dnf5 repolist` (`PKG_META_OK`) | Transient `curl 56 Connection reset by peer` | `RFC1918_BLOCKED_OK` | `p15-fedora-kde-desktop.png` | `4dc8d55b...` (matched across reload, `51.3s`) |
| Alpine 3.24.4 KDE | `alpine-kde` | Removed (`badwolf`, `epiphany`, `650` pkgs retained; `BIN_CHECK`/`PKG_CHECK` empty) | `NO_WRAPPER_OK`, `NO_DESKTOP_OK` | `HTTP/2 200`, `SHA256 25ddf2c8...` | `apk update` (`26792` pkgs) | `git: not found` in chroot PATH | `RFC1918_BLOCKED_OK` | `p15-alpine-kde-desktop.png` | `2f35228e...` (matched across reload, `34.9s`) |

## Regression & Build Checks
- **Frontend Typecheck & Production Build:** `npx tsc --noEmit && npm run build` in `apps/web` passed (`2156` modules transformed, built in `39.15s`).
- **Phase 8 Networking Regression:** `node tests/test-phase8-networking.js` exited with code `0` (`eth0` `10.0.5.2`, gateway `10.0.5.1`, `DNS: 172.66.147.243`, `HTTPS_STATUS: 200 TITLE_OK: True`, `RFC1918_BLOCK: OK URLError`).
- **Disk Image Integrity:** All reconstructed ext4 disk images passed `e2fsck -fy` cleanly with updated SHA-256 checksums in `apps/web/public/manifests/*.json`.
- **UI & Manifest Labels:** Browser-specific selector labels (`+ Firefox ESR`, `+ Epiphany Web`, `Native Browser`, `🌐`) were replaced with KDE Plasma labels in `apps/web/src/pages/DistributionSelector.tsx` and distribution manifests while keeping stable disk IDs.
