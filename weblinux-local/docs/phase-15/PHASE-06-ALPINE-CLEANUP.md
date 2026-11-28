# Phase 15 — Agent 6: Alpine 3.24.4 KDE Browser Cleanup

## Summary

Created [`cleanup-alpine-browser.sh`](../../scripts/cleanup-alpine-browser.sh) to remove the Alpine 3.24.4 RISC-V browser packages (`epiphany`, `badwolf`) and the project-added browser launcher/desktop entry from `alpine-kde.ext4`, while preserving desktop, networking, and package-management infrastructure.

## Script Behavior (`scripts/cleanup-alpine-browser.sh`)

1. **Image Reconstruction**
   - Reconstructs `/root/alpine-cleanup/alpine-kde.ext4` (overridable via `ALPINE_CLEANUP_DIR`) from 1 MiB chunks and `manifest.json` in `/mnt/d/weblinux-disks/alpine-kde` (overridable via `ALPINE_CHUNKS_DIR`), writing zero-filled 1 MiB blocks where `manifest["hashes"][i]` is empty.
2. **Chroot Package & Launcher Removal**
   - Loop-mounts `alpine-kde.ext4`, copies `/usr/bin/qemu-riscv64-static`, and mounts `proc`, `sysfs`, and `--bind /dev` with an `EXIT` trap for cleanup.
   - Runs `apk del epiphany badwolf` and clears `/var/cache/apk/*` inside the RISC-V chroot.
   - Preserves `gvfs`, `dbus`, Plasma 6.6.6, `curl`, `wget`, `git`, `apk`, and APK signature verification (no `--allow-untrusted`, `/etc/apk/keys` untouched).
   - Removes `/usr/local/bin/weblinux-browser` and `/usr/share/applications/weblinux-browser.desktop` while preserving `/root/browser-home`.
3. **Filesystem Check & Chunk Slicing**
   - Unmounts chroot filesystems and runs `e2fsck -fy` on `alpine-kde.ext4`.
   - Removes stale 6-digit chunk files from `/mnt/d/weblinux-disks/alpine-kde` and `/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/alpine-kde` (overridable via `ALPINE_PUBLIC_DIR`).
   - Slices non-zero 1 MiB chunks to `/mnt/d/weblinux-disks/alpine-kde`, generates `manifest.json` (including the `present` hex bitmask) and `integrity.json` to both directories, and verifies full-image SHA-256 reconstruction.

## Verification

- Syntax check executed:
  ```powershell
  wsl -d Fedora-45 -u root -- bash -n /mnt/e/Web-Linux/weblinux-local/scripts/cleanup-alpine-browser.sh
  ```
  Result: exit code `0` (no syntax errors).
- Multi-GiB ext4 reconstruction and chunk repackaging were **not** executed here; they are deferred to sequential Lead Orchestrator execution to avoid WSL OOM.
