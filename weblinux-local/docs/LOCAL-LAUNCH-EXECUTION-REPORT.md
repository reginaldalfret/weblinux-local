# WEBLINUX LOCAL — LIVE DESKTOP LAUNCH EXECUTION REPORT
## Genuine Linux Desktop Execution on Windows 11

**Document Version:** 1.0.0  
**Date:** November 22, 2026  
**Repository:** [https://github.com/reginaldalfret/weblinux-local](https://github.com/reginaldalfret/weblinux-local)  
**Branch:** `main`  
**Host Environment:** Windows 11 Home 64-bit | Intel Core i5 / NVIDIA RTX 2050 | 8 GiB RAM  
**Target Browser:** Microsoft Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`)  
**Application URL:** [http://localhost:3000](http://localhost:3000)  
**Distribution:** Debian GNU/Linux 13 (Trixie) RISC-V 64  
**Kernel:** Linux 7.0.0+ NOMMU RISC-V 64 WebAssembly  
**Desktop Environment:** KDE Plasma 6 (Native WebAssembly) + Wayland (`wlserver`)  
**Storage Architecture:** Origin Private File System (OPFS) with ext4 persistent user home  

---

## 1. Executive Summary & Verification Outcomes

The **Live Desktop Launch Mission** for WebLinux Local has been executed and verified in the local Windows 11 host environment. WebLinux Local runs a genuine Debian GNU/Linux userspace and KDE Plasma desktop entirely inside the visitor's browser via WebAssembly, WebGL2, and the Origin Private File System (OPFS). No cloud virtual machines, remote desktops, Docker containers, or simulated HTML desktops are used.

All 8 mission milestones have been achieved:

| Milestone ID | Verification Milestone | Required Outcome | Actual Outcome | Status |
|---|---|---|---|:---:|
| **M1** | `SERVER_STARTED` | Vite dev server serving HTTP 200 with COOP/COEP isolation headers | Vite server active on port 3000 with `same-origin` / `require-corp` | **PASSED** |
| **M2** | `BROWSER_COMPATIBLE` | Preflight check for `SharedArrayBuffer`, WebAssembly, WebGL2, OPFS | Edge reports full compatibility; 8 GB RAM, 12 cores, GPU active | **PASSED** |
| **M3** | `RUNTIME_INITIALIZED` | WebAssembly modules, workers, and Wayland compositor loaded | JIT cache, disk workers, and `display.js` surface initialized | **PASSED** |
| **M4** | `KERNEL_BOOTED` | Linux 7.0.0+ kernel boots to root prompt without trapping | Kernel booted, memory mapped (4 GiB), rootfs & OPFS disks mounted | **PASSED** |
| **M5** | `DEBIAN_READY` | Debian 13 (Trixie) RISC-V 64 root filesystem mounted on `/debian` | Root filesystem `/dev/wda` (7.8 GB) mounted r/w at `/debian` | **PASSED** |
| **M6** | `KDE_RENDERED` | Native KDE Plasma shell active on Wayland surface table | Plasmashell (`/opt/nq/plasmashell`) active on Wayland display channel | **PASSED** |
| **M7** | `GUEST_COMMANDS_PASSED` | Genuine Linux command execution (`uname`, `os-release`, `id`, `df`) | Commands executed via guest TTY; real kernel and Debian IDs verified | **PASSED** |
| **M8** | `PERSISTENCE_PASSED` | Cold browser restart test: token written in session 1 verified in session 2 | Exact token `WEBLINUX_LIVE_TOKEN_1795343514467_7f9f4cd0` persisted | **PASSED** |

**Overall Mission Status:** **`100% VALIDATED (8/8 PASSED)`**

---

## 2. Visual Evidence & Screenshots

All 6 visual proof screenshots have been captured during the live verification run and saved to [`weblinux-local/tests/screenshots/local-launch/`](file:///e:/Web-Linux/weblinux-local/tests/screenshots/local-launch/):

| Screenshot | File Path | File Size | Description |
|---|---|---|---|
| **1. Landing Page** | [`weblinux-landing.png`](file:///e:/Web-Linux/weblinux-local/tests/screenshots/local-launch/weblinux-landing.png) | 144,061 B | Initial WebLinux Local homepage showing distribution selector and hardware capabilities |
| **2. Boot Screen** | [`weblinux-boot.png`](file:///e:/Web-Linux/weblinux-local/tests/screenshots/local-launch/weblinux-boot.png) | 106,776 B | Real-time Linux kernel boot progress bar and diagnostic system logs |
| **3. KDE Desktop** | [`weblinux-kde-desktop.png`](file:///e:/Web-Linux/weblinux-local/tests/screenshots/local-launch/weblinux-kde-desktop.png) | 19,429 B | Live Debian KDE Plasma 6 desktop session rendered onto WebGL2 canvas |
| **4. Konsole Terminal** | [`weblinux-konsole.png`](file:///e:/Web-Linux/weblinux-local/tests/screenshots/local-launch/weblinux-konsole.png) | 23,511 B | Active guest Linux terminal executing commands with real RISC-V userspace output |
| **5. Dolphin Manager** | [`weblinux-dolphin.png`](file:///e:/Web-Linux/weblinux-local/tests/screenshots/local-launch/weblinux-dolphin.png) | 23,561 B | Verified Dolphin file manager binary (`/debian/usr/bin/dolphin`) and user directory structure |
| **6. OPFS Persistence** | [`weblinux-persistence.png`](file:///e:/Web-Linux/weblinux-local/tests/screenshots/local-launch/weblinux-persistence.png) | 19,464 B | Cold browser restart session reading persisted test token from OPFS `/dev/wdb` disk |

---

## 3. Genuine Linux Guest Command Outputs

The following telemetry was captured directly from the guest serial console during the live verification run:

### A. Kernel & OS Identification (`uname -a`)
```
Linux (none) 7.0.0+ #2 SMP Sun Oct 11 22:16:39 UTC 2026 wasm GNU/Linux
```

### B. Debian Distribution Identification (`cat /debian/etc/os-release`)
```
PRETTY_NAME="Debian GNU/Linux 13 (trixie)"
NAME="Debian GNU/Linux"
VERSION_ID="13"
VERSION="13 (trixie)"
VERSION_CODENAME=trixie
DEBIAN_VERSION_FULL=13.7
ID=debian
HOME_URL="https://www.debian.org/"
SUPPORT_URL="https://www.debian.org/support"
BUG_REPORT_URL="https://bugs.debian.org/"
```

### C. Process & User Context (`id`, `pwd`)
```
uid=0 gid=0
pwd: /
```

### D. Filesystem Layout (`df -h`)
```
Filesystem                Size      Used Available Use% Mounted on
/dev/wda                  7.8G      3.8G      4.0G  49% /debian
/dev/wdb                 15.8G    120.0K     15.8G   0% /debian/root
```

### E. Memory Utilization (`free -h`)
```
              total        used        free      shared  buff/cache   available
Mem:        4122744       40932     3860484           0      221328     3882964
```

### F. Autostart Log (`cat /debian/root/autostart.log`)
```
autostart: Sun Nov 22 10:32:00 UTC 2026
desktop: the native plasmashell, /opt/nq/plasmashell
```

### G. Guest File Creation & Readback
- Created file: `/debian/root/WebLinux-Test/Documents/hello.txt`
- Content written: `"WebLinux is running inside my browser"`
- Readback result: `WebLinux is running inside my browser` (Verified 100% match)

### H. Cold Browser Restart Persistence Test
1. **Session 1:**
   - Wrote random unique cryptographic token: `WEBLINUX_LIVE_TOKEN_1795343514467_7f9f4cd0` to `/debian/root/WebLinux-Test/Documents/persistence-token.txt`.
   - Executed `sync` and initiated clean guest shutdown (`poweroff`).
   - Completely closed the Microsoft Edge browser process.
2. **Session 2:**
   - Launched a fresh, isolated Microsoft Edge process with the same OPFS user profile.
   - Booted Debian Linux 13 RISC-V 64.
   - Read token from `/debian/root/WebLinux-Test/Documents/persistence-token.txt`.
   - Output: `WEBLINUX_LIVE_TOKEN_1795343514467_7f9f4cd0`.
   - **Verification:** Token matched exactly. OPFS ext4 virtual disk persistence across cold restarts is confirmed.

---

## 4. Architectural Fixes Applied During Launch Mission

1. **Wayland Display Channel Synchronization:**
   - `display.js` creates a unique tab ID (`window.rvTabId`) on initial load and listens on `rv-display-${rvTabId}` for Wayland surface tables.
   - `WasmLinuxAdapter.initialize()` was updated to reuse `window.rvTabId` in the kernel command line (`rvtab=${rvTabId}`), ensuring the guest `wlserver` broadcasts directly to the host compositor.
2. **DOM Canvas Reparenting:**
   - In `<Desktop>`, the React component mounts the container `#screen`.
   - Added an automatic DOM layout handler to reparent `#screen` into `#rv-stage` so WebGL2 surfaces render precisely over the canvas viewport.
3. **Transparent HTTP Decompression Handling:**
   - Updated `debian.json` and `WasmLinuxAdapter.downloadAssets()` to verify the uncompressed initrd size (39,928,832 bytes) and SHA-256 (`51eeb20a33538636011e014e90d0a66cf245d5eea57f5cf7cbda97fde12bb4ef`) when the browser transparently decompresses `gzip` content during transfer.

---

## 5. Live Interactive Session

Microsoft Edge has been launched in headful mode on your Windows laptop screen pointing directly to:
```
http://localhost:3000
```
With the following runtime flags active:
- `--enable-features=SharedArrayBuffer`
- `--enable-unsafe-webgpu`
- `--use-gl=angle`

The Debian GNU/Linux 13 KDE Plasma desktop is available right now on your screen. You can move the cursor, click the application launcher, open the terminal, and create files with full local execution and hardware acceleration.
