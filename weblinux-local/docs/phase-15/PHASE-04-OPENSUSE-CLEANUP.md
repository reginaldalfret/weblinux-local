# Phase 15-04: openSUSE Tumbleweed KDE Browser Cleanup

## Overview

`scripts/cleanup-opensuse-browser.sh` removes pre-installed browser application packages and WebLinux-specific browser launcher artifacts from the `opensuse-tumbleweed-kde` RISC-V ext4 disk image without disturbing Plasma 6, shared libraries, terminal networking tools, package signature verification, or user home directories.

## Implementation Summary

- **Script:** `weblinux-local/scripts/cleanup-opensuse-browser.sh`
- **Working directory:** `/root/opensuse-cleanup` (overridable via `OPENSUSE_CLEANUP_DIR`)
- **Chunk source/target:** `/mnt/d/weblinux-disks/opensuse-tumbleweed-kde` (overridable via `OPENSUSE_CHUNKS_DIR`)
- **Public metadata target:** `/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/opensuse-tumbleweed-kde` (overridable via `OPENSUSE_PUBLIC_DIR`)

### Execution Stages

1. **Image Reconstruction:**
   - Reads `manifest.json` from `CHUNKS` and reconstructs `opensuse-tumbleweed-kde.ext4` from 1 MiB (`1048576`-byte) non-zero chunk files (`000000`, `000001`, ...) and zero-filled sparse chunks.
2. **Chroot Browser Package Removal:**
   - Loop-mounts the ext4 image and binds `/usr/bin/qemu-riscv64-static`, `proc`, `sysfs`, and `/dev` with an `EXIT` cleanup trap.
   - Queries `rpm -q` for candidate browser packages:
     - `epiphany`
     - `epiphany-branding-openSUSE`
     - `chromium`
     - `MozillaFirefox`
     - `MozillaFirefox-branding-openSUSE`
   - Runs `zypper --non-interactive remove` **only** for the packages that are present, without `--clean-deps`, then runs `zypper clean --all`.
   - Removes `/usr/local/bin/weblinux-browser` and `/usr/share/applications/weblinux-browser.desktop`.
   - Preserves `/root/browser-home`, `~/.config`, `~/.cache`, `~/Downloads`, `~/.local/share`, Plasma 6, shared libraries (`gtk`, `webkit`, `nss`, `glib`, `qt`, etc.), terminal networking tools (`curl`, `wget`, `git`), `zypper`, and GPG verification.
3. **Filesystem Check:**
   - Unmounts the image and runs `e2fsck -fy` on `opensuse-tumbleweed-kde.ext4`.
4. **Chunk Slicing & Manifest Generation:**
   - Clears stale 6-digit chunk files in `CHUNKS`, slices the updated image into 1 MiB chunks, computes per-chunk SHA-256 hashes, full-image SHA-256, `boot` chunk list, and `present` hex bitmask.
   - Writes `manifest.json` and `integrity.json` to both `CHUNKS` and `PUB`, then removes `WORKDIR`.

## Validation

- Syntax check passed in WSL:
  ```powershell
  wsl -d Fedora-45 -u root -- bash -n /mnt/e/Web-Linux/weblinux-local/scripts/cleanup-opensuse-browser.sh
  ```
  Exit code: `0`.
- Line-ending check passed in WSL (`file` reported `Bourne-Again shell script, ASCII text executable`).
- Multi-GiB ext4 image reconstruction and repackaging were not executed in this step and are scheduled sequentially by the Lead Orchestrator.
