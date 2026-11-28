# Phase 15 — Debian 13 (Trixie) KDE Browser Cleanup Audit & Plan

## 1. Scope & Target Image
- **Manifest**: `apps/web/public/manifests/debian-firefox.json`
- **Image ID**: `debian-firefox` (`Debian GNU/Linux 13 (Trixie) + Epiphany Web`, `riscv64`, `linux-wasm64_nommu-6.1`, `kde-plasma`)
- **Chunk Storage**: `/mnt/d/weblinux-disks/debian-13-firefox` (`8192` total 1 MiB chunks, `8589934592` bytes / 8 GiB, `4486` non-zero chunks prior to cleanup, `64` boot chunks)
- **Public Metadata Directory**: `/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/debian-13-firefox`
- **Installer Audited**: `scripts/install-debian-browser.sh`
- **Cleanup Script**: `scripts/cleanup-debian-browser.sh`

## 2. Audit of `scripts/install-debian-browser.sh`
Review of `scripts/install-debian-browser.sh` identified the following browser artifacts added to the Debian 13 `riscv64` KDE image:
1. **Browser application packages** installed via `apt-get install -y --no-install-recommends`:
   - `epiphany-browser`
   - `epiphany-browser-data` (dependency of `epiphany-browser`)
   - `netsurf-gtk`
   - (Plus `firefox-esr` and `chromium` checked defensively in case present in the image)
2. **Project-added wrapper & desktop entry**:
   - `/usr/local/bin/weblinux-browser` (sets `HOME=/root/browser-home`, Wayland/WebKitGTK env vars, `MALLOC_ARENA_MAX=2`, `drop_caches`, and launches `epiphany` / `netsurf-gtk` via `setpriv` + `dbus-run-session`)
   - `/usr/share/applications/weblinux-browser.desktop` (if present)
3. **Preserved directories & core/shared packages**:
   - `/root/browser-home` and user directories (`~/.config`, `~/.cache`, `~/.local/share`, `~/Downloads`, `/home/*`) must be preserved.
   - Shared libraries (`gtk`, `webkit`, `nss`, `glib`, `qt`, `gvfs`, `dbus`) and terminal/networking/package tools (`curl`, `wget`, `git`, `ca-certificates`, `apt`) must remain untouched.
   - `apt autoremove` must **never** be used so shared libraries and KDE/system dependencies are not accidentally removed.
   - Package signature verification and TLS verification remain enabled (no `--allow-unauthenticated` or insecure flags).

## 3. Cleanup Plan (`scripts/cleanup-debian-browser.sh`)
1. **Reconstruct ext4 image**:
   - Reconstruct `/root/debian-cleanup/debian-13-firefox.ext4` (overridable via `DEBIAN_CLEANUP_DIR`) from `/mnt/d/weblinux-disks/debian-13-firefox/manifest.json` and 1 MiB chunk files (`000000`..).
2. **Chroot browser package removal**:
   - Loop-mount the image and bind `/usr/bin/qemu-riscv64-static`, `proc`, `sysfs`, and `/dev` with an `EXIT` trap for clean unmount.
   - Query `dpkg-query` for installed status of `epiphany-browser`, `epiphany-browser-data`, `netsurf-gtk`, `firefox-esr`, and `chromium`.
   - Remove only the installed browser packages using `DEBIAN_FRONTEND=noninteractive apt-get remove -y` (never `apt autoremove`) followed by `apt-get clean`.
   - Log `dpkg-query` status of `dbus`, `curl`, `wget`, `git`, `ca-certificates`, and `apt` to confirm core tools remain intact.
3. **Remove project-added launcher & desktop file**:
   - `rm -f "$MNT/usr/local/bin/weblinux-browser"`
   - `rm -f "$MNT/usr/share/applications/weblinux-browser.desktop"`
   - Leave `/root/browser-home` and all user home directories intact.
4. **Filesystem check & chunk re-slicing**:
   - Unmount chroot mounts and run `e2fsck -fy` on `debian-13-firefox.ext4`.
   - Slice the cleaned image into 1 MiB non-zero chunks in `/mnt/d/weblinux-disks/debian-13-firefox`.
   - Generate `manifest.json` (with `size`, `piece`, `id`, `hashes`, `boot`, and `present` hex bitmask) and `integrity.json` (`totalChunks`, `nonZeroChunks`, `bootChunks`, `fullImageSha256`, `imageSizeBytes`, `pieceSizeBytes`) in both `/mnt/d/weblinux-disks/debian-13-firefox` and `/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/debian-13-firefox`.
   - Verify round-trip reconstruction SHA-256 matches `fullImageSha256` and remove temporary `/root/debian-cleanup`.

## 4. Validation
- Syntax check executed via:
  ```bash
  wsl -d Fedora-45 -u root -- bash -n /mnt/e/Web-Linux/weblinux-local/scripts/cleanup-debian-browser.sh
  ```
  Result: exit code `0` (no syntax errors).
- Multi-GiB ext4 reconstruction and re-slicing are deferred to sequential execution by the Lead Orchestrator to avoid WSL OOM.
