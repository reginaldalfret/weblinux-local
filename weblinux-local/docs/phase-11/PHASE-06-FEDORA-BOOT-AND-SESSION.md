# Phase 11 — Custom WebLinux Boot & Session Supervisor

## 1. Initramfs Supervisor (`scripts/update-initramfs-fedora.sh`)

- Added `/bin/fedora-root` and `/bin/fedora-kde` to `apps/web/public/runtime/initramfs-wasm64_nommu.cpio.gz`.
- Patched `/init` for `distro=fedora*`:
  - `mount -t ext4 -o noatime /dev/wda /fedora`
  - `target_root="/fedora/root"` (`/dev/wdb`)
  - `/bin/fedora-root true`
- `/bin/fedora-root` mounts `/fedora/proc`, `/fedora/sys`, `/fedora/dev`, `/fedora/dev/pts`, `/fedora/run` (tmpfs), `/fedora/tmp` (tmpfs), and bind-mounts `/usr/lib/{hostnode,wlserver,rvgpu,hostopen}` into `/fedora/run/*`.

## 2. Session Supervisor (`/usr/local/bin/fedora-kde-session`)

- Exports `HOME=/root`, `XDG_RUNTIME_DIR=/tmp/runtime-root`, `WAYLAND_DISPLAY=wayland-0`, `QT_QPA_PLATFORM=wayland`, `XDG_CURRENT_DESKTOP=KDE`, `XDG_SESSION_TYPE=wayland`, `KDE_SESSION_VERSION=6`.
- Starts `dbus-daemon --system --fork` and `dbus-daemon --session --fork`.
- Starts `gpuserver` (`rvgpu-0.ready`) and `wlserver` in `WLSERVER_SHELL=plasma` mode (`wayland-0`).
- Runs `kbuildsycoca6` in background and launches `plasmashell --no-respawn` with `QT_QUICK_BACKEND=software QMLSCENE_DEVICE=softwarecontext LIBGL_ALWAYS_SOFTWARE=1`.
