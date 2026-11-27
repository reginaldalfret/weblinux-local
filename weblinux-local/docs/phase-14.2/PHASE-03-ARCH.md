# Phase 14.2 — Arch Linux RISC-V Browser Replacement (`PHASE-03-ARCH.md`)

## 1. Upstream Repository Audit (`extra.db`)

Queried `https://riscv.mirror.pkgbuild.com/repo/extra/extra.db` (`3,196,083` bytes) in WSL (`Fedora-45`) to inspect available `riscv64` browsers and dependencies:

| Package | Version | Arch | Compressed Size | Installed Size | SHA-256 | Notes |
|---|---|---|---|---|---|---|
| `chromium` | `157.0.8103.78-1` | `riscv64` | `150,149,158` B | `426,735,818` B | `a007a35ea3fd560443a39e1322877416a93dd74ce0d9ea196adad4525a8552eb` | **Broken upstream:** compiled against `libsimdutf.so.36`, while `extra` ships `simdutf 9.3.3-1` (`libsimdutf.so=37-64`). |
| `simdutf` | `9.3.3-1` | `riscv64` | `218,143` B | `1,161,544` B | `8b200e386546c22b3c69b6772ccb0f024e87ca56916eb86c0437fddbf8614c3c` | Provides `libsimdutf.so=37-64`. |
| `epiphany` | `51.2-1` | `riscv64` | `4,021,409` B | `18,316,267` B | `b5b9147f40e893ad629e3bec3d4ae91f0f995fd13d725e7bf43c280ca4eef0b2` | **Selected:** signed GNOME Web (`WebKitGTK 6.0`), matches `epiphany 51.2` proven on openSUSE Tumbleweed under `/bin/rv` NOMMU. |
| `webkitgtk-6.0` | `2.54.2-1` | `riscv64` | `36,316,674` B | `115,228,674` B | `ae0297b2d51cf3e87537405cf13a1f830abcd1a9b73dbdde4c301ab03fd294ec` | Provides `libwebkitgtk-6.0.so=4-64` and `libjavascriptcoregtk-6.0.so=1-64`. |
| `firefox` | `161.0-1` | `riscv64` | `89,848,517` B | `286,972,747` B | `9e22f70619b6f2d729bb879dd46eef5c8833b844748faf94ebf8e212a31f2b58` | Larger footprint (`~287 MiB` installed + `ffmpeg`/`nss`/`gtk3` deps). |
| `falkon` | `26.08.3-2` | `riscv64` | `3,728,428` B | `16,522,380` B | `04f53c6d5de7db62bf768624532d4950023ffd8f12bc3c37bcb0dc21a12bca48` | Depends on `qt6-webengine` (Chromium-based; hits NOMMU `fork()` and 359 MiB guest OOM). |

### Signature Verification
- Verified via `curl -sI` that `epiphany-51.2-1-riscv64.pkg.tar.zst.sig` and `webkitgtk-6.0-2.54.2-1-riscv64.pkg.tar.zst.sig` are present on `https://riscv.mirror.pkgbuild.com/repo/extra/` (`HTTP/2 200`, `content-type: application/pgp-signature`, `content-length: 566`).
- Pacman GPG signature verification (`SigLevel`) is preserved intact; no fake SONAME symlinks or cross-distro `.so` copies are used.

## 2. Implementation (`scripts/install-arch-browser.sh`)

Created `scripts/install-arch-browser.sh` (validated with `bash -n`, exit code `0`):
1. **Rootfs Preparation:** Reconstructs `/root/arch-test/arch-kde.ext4` from `/mnt/d/weblinux-disks/arch-kde` chunks if `/root/arch-test/rootfs` is not already present, and mounts `/proc`, `/sys`, `/dev`, `/dev/pts` for `qemu-riscv64-static` chroot.
2. **Package Replacement:**
   - Removes broken `chromium` (`pacman -R --noconfirm chromium`) to reclaim `~427 MiB`.
   - Installs signed `epiphany` (`pacman -Sy --noconfirm epiphany`), pulling `webkitgtk-6.0 2.54.2-1` and dependencies with full Pacman signature verification.
   - Ensures unprivileged `browser` user (`uid=1000`, `gid=1000`, `HOME=/root/browser-home`) and `chmod 711 /root`.
   - Archives `/var/cache/pacman/pkg/*` to `/mnt/d/weblinux-build/arch-pkg-cache` before imaging.
3. **Launcher & Desktop Entry:**
   - `/usr/local/bin/weblinux-browser`: sets `chmod 711 /root`, `/tmp/runtime-browser` (`0700`, `browser:browser`), `ln -sf /tmp/runtime-root/wayland-0 /tmp/runtime-browser/wayland-0`, `GDK_BACKEND=wayland`, `GSK_RENDERER=cairo`, `LIBGL_ALWAYS_SOFTWARE=1`, `NO_AT_BRIDGE=1`, `GTK_A11Y=none`, `JSC_useJIT=0`, `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`, and executes `setpriv --reuid="$BUID" --regid="$BGID" --clear-groups /usr/bin/dbus-run-session -- /usr/bin/epiphany "$@"`.
   - `/usr/share/applications/weblinux-browser.desktop`: updated to `Name=Epiphany Web Browser`, `Icon=org.gnome.Epiphany`, `Exec=/usr/local/bin/weblinux-browser %U`.
4. **Filesystem Check & Chunk Slicing:**
   - Formats `5368709120` B (`5.0 GiB`) ext4 image (`-L arch-kde -m 1 -O ^metadata_csum_seed`), runs `e2fsck -fy`, and slices `5120` x `1 MiB` chunks into `/mnt/d/weblinux-disks/arch-kde` with `manifest.json` (`present` bitmask) and `integrity.json` written to both `/mnt/d/weblinux-disks/arch-kde` and `apps/web/public/disk/arch-kde`.

## 3. Execution Status
- Script and documentation authored and syntax-checked (`bash -n` exit `0`).
- Multi-GiB ext4 reconstruction and live browser qualification are deferred to the Lead Orchestrator's scheduled WSL build/test turn.
