# Phase 15 — Ubuntu 24.04.5 LTS KDE Browser Cleanup (`PHASE-02-UBUNTU-CLEANUP.md`)

## Scope & Ownership
- **Agent:** Agent 2 (Ubuntu 24.04.5 KDE Cleanup)
- **Distribution ID:** `ubuntu-kde-epiphany` (`Ubuntu 24.04.5 LTS`, `riscv64`, `apt`)
- **Owned Files:**
  - `scripts/cleanup-ubuntu-browser.sh`
  - `docs/phase-15/PHASE-02-UBUNTU-CLEANUP.md`

## Baseline Layout & Manifest Inspection
- **Distribution Manifest (`apps/web/public/manifests/ubuntu-kde-epiphany.json`):**
  - `totalSizeBytes`: `3758096384` (3584 MiB, `chunkSize: 1048576`)
  - Baseline `fullImageSha256`: `7321ea53b91a9c396a8262a7015dd79479b120dcec0389166455813e7626c266`
  - Baseline `chunksCount`: `3584`, `nonZeroChunksCount`: `1862`, `bootChunksCount`: `52`
- **Chunk Store (`/mnt/d/weblinux-disks/ubuntu-24.04-kde-epiphany`):**
  - Contains 1 MiB chunk files `000000` through `003583`, plus `manifest.json` (896-char `present` hex bitmask) and `integrity.json`.
- **Public Metadata Directory (`apps/web/public/disk/ubuntu-24.04-kde-epiphany`):**
  - Contains `manifest.json` and `integrity.json`.

## Cleanup Script (`scripts/cleanup-ubuntu-browser.sh`)
The cleanup script performs the following steps:
1. **Reconstruct ext4 Image:** Rebuilds `/root/ubuntu-cleanup/ubuntu-24.04-kde-epiphany.ext4` from `/mnt/d/weblinux-disks/ubuntu-24.04-kde-epiphany` using `manifest.json` and verifies the exact byte size (`3758096384` bytes).
2. **Chroot Browser Package Removal:** Mounts the ext4 image with `qemu-riscv64-static`, `proc`, `sys`, and `/dev`, and checks for installed browser packages (`epiphany-browser`, `epiphany-browser-data`, `firefox`, `firefox-esr`, `chromium`, `chromium-browser`). Any installed browser packages are removed using `apt-get remove -y` **without** `apt autoremove -y`, preserving KDE Plasma 5.27.12, shared GTK/WebKit/Qt libraries, `curl`, `wget`, `git`, `ca-certificates`, and `apt` (verified via `dpkg-query` after removal).
3. **Wrapper & Desktop Entry Removal:** Removes `/usr/local/bin/weblinux-browser` and `/usr/share/applications/weblinux-browser.desktop` if present, while preserving `/home/ubuntu` and `/root` user files.
4. **Filesystem Check & Re-Slicing:** Unmounts cleanly, runs `e2fsck -fy`, slices 1 MiB non-zero chunks (`000000`–`003583`) to `/mnt/d/weblinux-disks/ubuntu-24.04-kde-epiphany`, writes updated `manifest.json` (with `present` hex bitmask) and `integrity.json` to both `/mnt/d/weblinux-disks/ubuntu-24.04-kde-epiphany` and `/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/ubuntu-24.04-kde-epiphany`, and verifies round-trip SHA-256 reconstruction.

## Validation
- **Syntax Check:** `wsl -d Fedora-45 -u root -- bash -n /mnt/e/Web-Linux/weblinux-local/scripts/cleanup-ubuntu-browser.sh` exited with code `0` (`CRLF_COUNT 0`).
- **Image Repackaging Status:** Multi-GiB ext4 reconstruction/re-slicing was not executed by Agent 2 and is deferred to the Lead Orchestrator's sequential execution pass to avoid WSL memory exhaustion.
