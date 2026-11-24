# WEBLINUX LOCAL — PHASE 5.1
# KNOWN ISSUES & TECHNICAL DEBT INVENTORY

**Document ID:** `PHASE5-1-ISSUES-001`  
**Phase:** 5.1 Multi-Desktop Integration  
**Overall Status:** `PARTIALLY_VALIDATED`

---

## 1. Missing Binary Packages for Alternative Desktops

- **Issue:** GNOME 48 (`mutter`, `gnome-shell`, `nautilus`, `gnome-terminal`) and XFCE 4.20 (`labwc`, `xfce4-session`, `xfce4-panel`, `thunar`, `xfce4-terminal`) binaries are not preinstalled on the Debian 13 RISC-V 64-bit NOMMU release disk image (`/disk/release/`).
- **Impact:** While the runtime architecture, rootfs identity isolation, dedicated session launchers, Wayland bridging protocols, and persistent storage are fully functional, attempting to boot live GNOME or XFCE sessions triggers the launcher's diagnostic error trap with exit code 127.
- **Root Cause:** The upstream distribution image is bundled specifically with KDE Plasma 6. Precompiled NOMMU-compatible binaries for Mutter and Labwc have not yet been layered into `/disk/release/`.
- **Status:** Documented and cleanly trapped. Acceptance tests for GUI components report `BLOCKED` rather than false passes.
- **Resolution Plan:** Produce multi-rootfs disk images (`debian-13-gnome.img`, `debian-13-xfce.img`) with cross-compiled RISC-V NOMMU package sets in Phase 6.

---

## 2. Windows VirtualAlloc Memory64 Guard Pressure

- **Issue:** Chromium-based browsers (Google Chrome and Microsoft Edge) on Windows 11 previously crashed with `STATUS_ACCESS_VIOLATION`, `STATUS_STACK_OVERFLOW`, or `Crashpad_NotConnectedToHandler` when `WebAssembly.Memory` declared a 16 GiB maximum (`0x40000` pages).
- **Resolution:** Capped `WebAssembly.Memory` maximum to 4 GiB (`0x10000` pages) in `apps/web/public/linux.js` and `apps/web/public/runtime/linux.js`. This guarantees that V8's virtual memory reservation remains well within host limits, even when the user has multiple heavy tabs open.

---

## 3. GitHub Actions Linux Rollup Native Binary Discrepancy

- **Issue:** GitHub Actions CI run `45218156345` failed during `npm run build` with `Cannot find module @rollup/rollup-linux-x64-gnu`.
- **Resolution:** Updated `apps/web/package.json` with cross-platform optional dependencies and added pre-install steps in `.github/workflows/ci.yml`. Verified local and CI build readiness.
