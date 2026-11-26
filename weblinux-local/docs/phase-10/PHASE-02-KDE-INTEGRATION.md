# Phase 10 — KDE Plasma 6.8.2 & Wayland Integration

## 1. Installed KDE Stack

- `plasma6-workspace-6.8.2-1.1.riscv64`
- `plasma6-desktop-6.8.2-1.1.riscv64`
- `kwin6-6.8.2-2.1.riscv64`
- `qt6-wayland-6.12.0-3.1.riscv64`
- `konsole-26.08.3-1.1.riscv64`
- `dolphin-26.08.3-1.1.riscv64`
- `breeze6-6.8.2-1.1.riscv64`, `breeze6-cursors-6.8.2-1.1.noarch`

## 2. Session Supervisor (`/usr/local/bin/opensuse-kde-session`)

1. Exports `HOME=/root`, `XDG_RUNTIME_DIR=/tmp/runtime-root`, `WAYLAND_DISPLAY=wayland-0`, `QT_QPA_PLATFORM=wayland`, `XDG_CURRENT_DESKTOP=KDE`, `XDG_SESSION_DESKTOP=KDE`, `XDG_SESSION_TYPE=wayland`, `KDE_SESSION_VERSION=6`.
2. Starts system and session `dbus-daemon` (`/run/dbus/system_bus_socket`, `$XDG_RUNTIME_DIR/bus`).
3. Starts `gpuserver` (`rvgpu-0.ready`) and `wlserver` in `WLSERVER_SHELL=plasma` mode (`wayland-0`).
4. Builds `kbuildsycoca6` cache in background and launches `plasmashell --no-respawn` with `QT_QUICK_BACKEND=software QMLSCENE_DEVICE=softwarecontext LIBGL_ALWAYS_SOFTWARE=1`.
