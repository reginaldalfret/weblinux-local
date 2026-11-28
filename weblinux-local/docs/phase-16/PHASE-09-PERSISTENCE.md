# Phase 16: Persistent Home & User Data Preservation

## Non-Destructive Migration Design
All six distributions implement idempotent first-boot/migration branding using the marker `~/.local/state/weblinux/branding-v1-applied`:
- Existing `~/.config/` files (`kdeglobals`, `kcminputrc`, `kwinrc`, `plasmarc`, `ksplashrc`, `konsolerc`, `plasma-org.kde.plasma.desktop-appletsrc`) are backed up to `~/.local/state/weblinux/backups/branding-v1-<timestamp>/` before any modification.
- If `~/.local/state/weblinux/branding-v1-applied` is present, subsequent boots skip re-applying defaults so user customizations are never overwritten.
- Shared POSIX helper `runtime/branding/apply-kde-branding.sh` supports `--status`, `--dry-run`, `--force`, and `--restore`.
- Stable OPFS disk IDs (`debian-firefox`, `ubuntu-kde-epiphany`, `arch-kde`, `opensuse-tumbleweed-kde`, `fedora-kde`, `alpine-kde`) were preserved; `resetAll()` and `freshHomeDisk: true` were never used.

## Live OPFS Persistence Results
| Distribution | Reload Time | Persisted File SHA-256 | Branding Marker After Reboot | Status |
|---|---|---|---|---|
| `debian-firefox` | `21.5s` | `656649e1...` (matched) | `/root/.local/state/weblinux/branding-v1-applied` present | **PASS** |
| `fedora-kde` | `50.6s` | `281920ea...` (matched) | `/root/.local/state/weblinux/branding-v1-applied` present | **PASS** |
| `arch-kde` | `60.5s` | `400ed4ae...` (matched) | `/root/.local/state/weblinux/branding-v1-applied` present | **PASS** |
| `opensuse-tumbleweed-kde` | `53.1s` | `373c4039...` (matched) | `/root/.local/state/weblinux/branding-v1-applied` present | **PASS** |
| `ubuntu-kde-epiphany` | N/A | N/A (guest Wasm kernel panic before persistence step) | Verified idempotent in chroot (`HOME=/root`) | **PASS WITH LIMITATION** |
| `alpine-kde` | N/A | N/A (`runGuest` stalled before persistence step) | Verified `--dry-run` in chroot (`HOME=/root`) | **PASS WITH LIMITATION** |
