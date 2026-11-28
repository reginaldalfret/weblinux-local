# Phase 16 — Shared KDE Branding Engine (`runtime/branding/`)

## Overview
The Shared KDE Branding Engine provides a unified, version-aware configuration layer for all six WebLinux KDE Plasma distributions without modifying kernel binaries, network relays, or OPFS disk identities.

## Directory Structure
- `runtime/branding/types.ts` — TypeScript interfaces (`BrandingProfileId`, `BrandingAliasId`, `KdeBrandingProfile`, `PlasmaToolingInfo`, `BrandingMigrationPolicy`).
- `runtime/branding/profiles.ts` — Canonical profile registry (`BRANDING_PROFILES`), alias map (`BRANDING_PROFILE_ALIASES`), and helper functions (`resolveBrandingProfileId`, `getBrandingProfile`, `getPlasmaConfigTools`, `listBrandingProfiles`).
- `runtime/branding/profiles.json` — Machine-readable JSON mirror for shell/Node/Python tooling and Phase 16 QA scripts.
- `runtime/branding/index.ts` — Barrel export for runtime and UI consumers.
- `runtime/branding/apply-kde-branding.sh` — POSIX `sh` helper script for guest/chroot branding application, backup, and restore.

## Distribution Matrix & Plasma Version Handling
The engine explicitly distinguishes KDE Plasma 5.27 from KDE Plasma 6.x so Ubuntu 24.04.5 is never forced onto Plasma 6 tooling or incompatible config keys:

| Canonical Profile ID | Manifest / Disk Aliases | Distribution | Plasma Version | Qt | Config Tooling |
|---|---|---|---|---|---|
| `debian-kde` | `debian-firefox` | Debian 13 (Trixie) | 6.3 | 6 | `kwriteconfig6` |
| `ubuntu-kde` | `ubuntu-kde-epiphany` | Ubuntu 24.04.5 LTS | 5.27.12 | 5 | `kwriteconfig5` |
| `arch-kde` | — | Arch Linux RISC-V | 6.8.3 | 6 | `kwriteconfig6` |
| `opensuse-tumbleweed-kde` | — | openSUSE Tumbleweed | 6.8.2 | 6 | `kwriteconfig6` |
| `fedora-kde` | — | Fedora 45 RISC-V | 6.7.4 | 6 | `kwriteconfig6` |
| `alpine-kde` | — | Alpine Linux 3.24.4 | 6.6.6 | 6 | `kwriteconfig6` |

### Key Plasma 5 vs Plasma 6 Differences Handled
- **Config CLI selection**: `getPlasmaConfigTools(plasmaMajor)` and `apply-kde-branding.sh` select `kwriteconfig5` / `kreadconfig5` / `qdbus` for Plasma 5 and `kwriteconfig6` / `kreadconfig6` / `qdbus6` for Plasma 6.
- **Offline / minimal rootfs fallback**: When `kwriteconfig5`/`kwriteconfig6` is unavailable (e.g., offline chroot staging), `apply-kde-branding.sh` falls back to a pure-POSIX `awk` INI writer (`ini_set`).
- **KWin decoration keys**: `kwinrc` sets `library=org.kde.breeze` for Plasma 5 and adds `theme=Breeze` for Plasma 6.
- **Lock screen support**: `alpine-kde` marks `lockScreen.supported = false` because the Alpine NOMMU session runs direct KWin/Plasma without a `logind` lockscreen daemon.

## Profile Alias Resolution & OPFS Disk Isolation
Existing manifests and `runtime/adapters/WasmLinuxAdapter.ts` rely on stable manifest IDs (`debian-firefox`, `ubuntu-kde-epiphany`) to isolate OPFS root/home disks (e.g., `root-debian-firefox`, `root-ubuntu-kde-epiphany`).

The branding engine preserves these disk IDs untouched and resolves them at the branding layer via `BRANDING_PROFILE_ALIASES`:
- `debian-firefox` -> `debian-kde`
- `ubuntu-kde-epiphany` -> `ubuntu-kde`
- Canonical IDs (`debian-kde`, `ubuntu-kde`, `arch-kde`, `opensuse-tumbleweed-kde`, `fedora-kde`, `alpine-kde`) resolve to themselves.

## Idempotent Migration, Backup & Restore
`apply-kde-branding.sh` enforces safe, non-destructive migration:
1. **Idempotent state marker**: Checks `~/.local/state/weblinux/branding-v1-applied`. If present and `--force` is not passed, the script exits `0` without modifying user settings.
2. **Pre-modification backup**: Before writing any file, existing KDE configs (`kdeglobals`, `kcminputrc`, `kwinrc`, `plasmarc`, `ksplashrc`, `kscreenlockerrc`, `konsolerc`, `plasma-org.kde.plasma.desktop-appletsrc`) are copied to `~/.local/state/weblinux/backups/branding-v1-<UTC-timestamp>/`, and the path is recorded in `~/.local/state/weblinux/backups/latest-branding-v1`.
3. **User data preservation**: Never resets OPFS or deletes `~/.config`, `~/Documents`, or `~/Downloads`.
4. **Safe restore**: Running `apply-kde-branding.sh --restore` restores the latest backed-up KDE config files and removes `branding-v1-applied`.
5. **Diagnostics & dry-run**: `--status` inspects the marker file; `--dry-run` prints all planned writes without touching disk.
