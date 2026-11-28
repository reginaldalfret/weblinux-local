# Phase 15 — Arch Linux KDE Browser Cleanup (`PHASE-03-ARCH-CLEANUP`)

## Objective
Remove the browser applications (`epiphany` and `chromium`, if installed) and project-added browser launcher artifacts from the Arch Linux RISC-V KDE disk image (`arch-kde`) while preserving Plasma 6, Dolphin, Konsole, terminal networking tools (`curl`, `wget`, `git`), `pacman` with full Pacman GPG signature verification, shared libraries, and `/root/browser-home`.

## Script Created
- [`scripts/cleanup-arch-browser.sh`](../../scripts/cleanup-arch-browser.sh)

## Implementation Summary
1. **Image Reconstruction**: Reconstructs `/root/arch-cleanup/arch-kde.ext4` from the 1 MiB chunk directory `/mnt/d/weblinux-disks/arch-kde` using `manifest.json` (`size`, `piece`).
2. **Chroot Package Removal**: Loop-mounts `/root/arch-cleanup/arch-kde.ext4` at `/root/arch-cleanup/mnt`, copies `/usr/bin/qemu-riscv64-static`, mounts `proc`, `sysfs`, `dev`, and `devpts`, and runs inside `chroot`:
   - Checks `pacman -Q epiphany` and `pacman -Q chromium`; if installed, removes each using exact `pacman -R --noconfirm` (without `-Rs` cascade so shared libraries such as `gtk`, `webkit`, `nss`, `glib`, `qt`, `libsimdutf`, `gvfs`, and `dbus` are not cascaded out).
   - Verifies retained packages (`pacman`, `curl`, `wget`, `git`, `dolphin`, `konsole`) via `pacman -Q`.
   - Leaves `/etc/pacman.conf` and Pacman signature verification (`SigLevel`) untouched.
3. **Launcher & Desktop Entry Removal**:
   - Removes `/usr/local/bin/weblinux-browser` and `/usr/share/applications/weblinux-browser.desktop`.
   - Preserves `/root/browser-home` and user data directories.
4. **Filesystem Check & Chunk Repackaging**:
   - Unmounts chroot virtual filesystems, removes `qemu-riscv64-static`, syncs, and unmounts the loop image.
   - Runs `e2fsck -fy /root/arch-cleanup/arch-kde.ext4` (allowing exit codes `0` or `1` for corrected clean checks; failing on `>= 2`).
   - Slices the image into 1 MiB (`1048576`-byte) chunks in `/mnt/d/weblinux-disks/arch-kde`.
   - Generates `manifest.json` (including `size`, `piece`, `id`, `hashes`, `boot`, and `present` hex bitmask) and `integrity.json` in both `/mnt/d/weblinux-disks/arch-kde` and `/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/arch-kde`.
   - Removes `/root/arch-cleanup/arch-kde.ext4` after slicing.

## Validation
- Syntax check executed in WSL (`Fedora-45`):
  ```powershell
  wsl -d Fedora-45 -u root -- bash -n /mnt/e/Web-Linux/weblinux-local/scripts/cleanup-arch-browser.sh
  ```
  - Exit code: `0` (no syntax errors).
- File type check in WSL (`Fedora-45`):
  - `Bourne-Again shell script, Unicode text, UTF-8 text executable` (LF line endings).
- Multi-GiB ext4 reconstruction/repackaging was **not** executed by Agent 3 (deferred to Lead Orchestrator sequential execution to avoid WSL OOM).
