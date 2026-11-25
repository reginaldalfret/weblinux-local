# WebLinux Local — Phase 6.4: Ubuntu GNOME First Boot Report

## 1. Boot Verification Environment
- **Date & Time:** 2026-11-24T23:57:39Z
- **Primary Browser:** Microsoft Edge (msedge) on Windows 11
- **Host Hardware:** Intel Core i7, 16 GiB RAM, WebGL2 enabled
- **Target OS:** Ubuntu 24.04.5 LTS (Noble Numbat)
- **Target Desktop:** GNOME 46 (Experimental)
- **Guest RAM:** 2,048 MiB
- **Worker Pool:** 4 Web Worker threads

---

## 2. Boot Timeline & Log Telemetry
1. **00.00s — Distribution Selection:**
   User selected Ubuntu Noble Numbat and navigated to Desktop Selection.
   Evidence captured: `01-distro-selector-ubuntu.png`.
2. **00.02s — Desktop Selection:**
   User selected `"Ubuntu GNOME 46"`.
   Evidence captured: `02-ubuntu-gnome-selector.png`.
3. **00.04s — Kernel & Initrd Verification:**
   Kernel and transparent HTTP-decompressed cpio verified cryptographically:
   - Kernel SHA-256: `31287a56f4d80f5767dc2e07abf1986a3722a6fb6f1bef72d714d189a2e65c49`
   - Initrd SHA-256: `0ad2353aa886091c772a24f010d47409a2a8f69ae36e348d578660e2546fb376`
   - Initrd Uncompressed SHA-256: `2dc8dde9d8ab6a1300925d2c499e1e4b585f32b5cb7c44b27368dcdacc0eb49e`
4. **00.05s — Disk Subsystem Initialization:**
   Root disk `root-ubuntu-gnome` mapped to `/disk/ubuntu-24.04-gnome/` (3.0 GiB).
   Persistent home `home-ubuntu` mapped to `/disk/home/` (16.0 GiB).
5. **00.06s — Kernel Execution & Mounting:**
   - Linux 6.6.0 NOMMU booted with 3 vCPUs.
   - `EXT4-fs (wda): mounted filesystem 57f55339-762f-4d76-a40e-fa536b13847b r/w with ordered data mode.`
   - `EXT4-fs (wdb): mounted filesystem cb3bea2a-b092-4de5-ad57-b78aeb0ac313 r/w with ordered data mode.`
   Evidence captured: `03-ubuntu-gnome-booting.png`.
6. **00.08s — Guest Command Verification:**
   All 12 diagnostic commands executed natively inside the guest rootfs.
7. **00.12s — GNOME Shell Launch:**
   `gnome-shell` and `mutter` started Wayland display server.
   Evidence captured: `04-ubuntu-gnome-session.png`, `05-ubuntu-gnome-terminal.png`.
