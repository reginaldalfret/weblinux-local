# Phase 13.6 — Wayland & KDE Session Integration

**Date:** 2026-11-27  
**Session Supervisor:** `/usr/local/bin/alpine-kde-session` (inside rootfs)

---

## 1. Wayland & Plasma 6.6.6 Session Configuration

- **Environment:** `WAYLAND_DISPLAY=wayland-0`, `XDG_RUNTIME_DIR=/tmp/runtime-root`, `QT_QPA_PLATFORM=wayland`, `XDG_CURRENT_DESKTOP=KDE`, `XDG_SESSION_DESKTOP=KDE`, `XDG_SESSION_TYPE=wayland`, `KDE_SESSION_VERSION=6`.
- **D-Bus:** Starts both system bus (`/run/dbus/system_bus_socket`) and session bus (`unix:path=$XDG_RUNTIME_DIR/bus`).
- **Compositor:** Launches WebLinux `wlserver` in `WLSERVER_SHELL=plasma` mode.
- **RVGPU & Software Fallback:** Probes `rvgpu-0` (`GALLIUM_DRIVER=virpipe`, `VTEST_SOCKET_NAME=$XDG_RUNTIME_DIR/rvgpu-0`) and launches `plasmashell --no-respawn` with `QT_QUICK_BACKEND=software QMLSCENE_DEVICE=softwarecontext LIBGL_ALWAYS_SOFTWARE=1` to avoid Qt 6 multi-surface RVGPU stalls.
