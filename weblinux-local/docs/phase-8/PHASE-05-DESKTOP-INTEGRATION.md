# Phase 8 — Phase 5: Desktop & Runtime Integration

**Date:** 2026-11-25

---

## 1. Runtime & UI Integration

1. **Distribution Types & Manifests:**
   - Added `'debian-firefox'` and `'ubuntu-kde-epiphany'` to `DistributionId` in [`runtime/types.ts`](file:///E:/Web-Linux/weblinux-local/runtime/types.ts).
   - Created [`apps/web/public/manifests/debian-firefox.json`](file:///E:/Web-Linux/weblinux-local/apps/web/public/manifests/debian-firefox.json) (`baseUri: "/disk/debian-13-firefox/"`).
   - Created [`apps/web/public/manifests/ubuntu-kde-epiphany.json`](file:///E:/Web-Linux/weblinux-local/apps/web/public/manifests/ubuntu-kde-epiphany.json) (`baseUri: "/disk/ubuntu-24.04-kde-epiphany/"`).
2. **Storage & OPFS Isolation:**
   - Updated [`runtime/adapters/WasmLinuxAdapter.ts`](file:///E:/Web-Linux/weblinux-local/runtime/adapters/WasmLinuxAdapter.ts) to map:
     - `ubuntu-kde-epiphany` -> `rootDiskId = 'root-ubuntu-kde-epiphany'`, `homeDiskId = 'home-ubuntu'`
     - `debian-firefox` -> `rootDiskId = 'root-debian-firefox'`, `homeDiskId = 'home-debian'`
   - Existing `root-debian-kde-plasma`, `root-ubuntu-kde`, `root-ubuntu-gnome`, `home-debian`, and `home-ubuntu` remain untouched.
3. **Frontend Selector & Dev/Preview Serving:**
   - Updated [`apps/web/src/App.tsx`](file:///E:/Web-Linux/weblinux-local/apps/web/src/App.tsx), [`apps/web/src/pages/DistributionSelector.tsx`](file:///E:/Web-Linux/weblinux-local/apps/web/src/pages/DistributionSelector.tsx), and [`apps/web/src/pages/DesktopSelector.tsx`](file:///E:/Web-Linux/weblinux-local/apps/web/src/pages/DesktopSelector.tsx) to expose both browser-enabled profiles.
   - Updated [`apps/web/vite.config.ts`](file:///E:/Web-Linux/weblinux-local/apps/web/vite.config.ts) (both dev and preview middlewares) to serve `/disk/*` from `public/disk/` or `D:\weblinux-disks\` before remote fallback.
4. **Shared Guest Launcher:**
   - `/usr/local/bin/browser` detects `/etc/os-release` (`ubuntu` -> `/usr/local/bin/epiphany-weblinux`, Debian -> `/usr/local/bin/firefox-esr-weblinux`) and validates the Wayland socket (`$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY`) before `exec`.
   - Desktop entries installed at `/usr/share/applications/org.gnome.Epiphany.desktop` and `/usr/share/applications/firefox-esr.desktop`.
