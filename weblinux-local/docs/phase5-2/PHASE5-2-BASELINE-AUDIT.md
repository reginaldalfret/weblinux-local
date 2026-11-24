# WEBLINUX LOCAL — PHASE 5.2
# SYSTEM BASELINE & ARCHITECTURAL AUDIT REPORT

**Document ID:** `PHASE5-2-AUDIT-001`  
**Workspace:** `E:\Web-Linux`  
**Repository:** `https://github.com/reginaldalfret/weblinux-local`  
**Current Baseline Commit:** `22ad810bef90041d4316f2acbad4f7e9c1cd3c2f`  
**Target Architecture:** RISC-V 64-bit NOMMU, Linux 6.6.0, WebAssembly  
**Host Platform:** Windows 11 (Microsoft Edge & Google Chrome)  
**Date:** 2026-11-24  

---

## 1. Executive Summary

This audit establishes the ground-truth technical baseline of the WebLinux Local project prior to executing Phases 5.2 through 5.6. It compares declared architectural promises against actual source-code implementation in the repository, identifying verified capabilities, existing technical debt, and critical blockers.

---

## 2. Existing Architecture & Subsystem Inspection

### 2.1 Kernel and Initramfs Runtime
- **Kernel Image:** `/runtime/vmlinux-wasm64_nommu.wasm` (7,380,050 bytes, SHA-256 `31287a56...`).
  - Architecture: RISC-V 64-bit NOMMU (`rv64imac` without MMU hardware paging).
  - Version: Linux 6.6.0 SMP.
  - Runtime execution: Browser WebAssembly runtime via JIT compiler and Web Worker thread pool (`/linux-worker.js`).
- **Initial Ramdisk:** `/runtime/initrd.img` (18,485,248 bytes, SHA-256 `bb00ec7d...`).
  - Contains `/init` script, busybox tools, `/dev/wda` ext4 mounter, and wlserver Wayland bridge (`/usr/lib/wlserver/desktop`).

### 2.2 Boot Pipeline & Mounting Sequence
Actual sequence observed inside the guest kernel:
1. Web Worker 0 boots the Linux kernel using WebAssembly shared memory.
2. Kernel extracts `initrd.img` into rootfs (`/dev/root`).
3. `/init` creates tmpfs mounts on `/dev` and `/tmp`.
4. `/init` mounts the primary ext4 block device `/dev/wda` at `/debian`.
5. `/init` mounts the secondary ext4 block device `/dev/wdb` at `/debian/root` (persistent user home).
6. `/init` executes `/bin/debian` wrapper or `/debian/usr/local/bin/desktop wayland plasma-native`.
7. `wlserver` binds UNIX domain sockets in `/tmp/runtime-root/wayland-0` and `/run/wlserver/wayland-0`.
8. `plasmashell` and `kwin_wayland` render GUI surfaces into the shared memory display buffer mapped to the HTML5 canvas via WebGL2.

### 2.3 Storage Architecture & OPFS Layout
- Block driver: Custom Web Worker (`/disk-worker.js`) communicating with Origin Private File System (OPFS).
- Block size: 1 MiB sparse chunks downloaded on-demand from the base URI and cached in OPFS.
- Partition structure:
  - `/dev/wda` (Root Partition): Sourced from `/disk/release/` chunk manifest.
  - `/dev/wdb` (Persistent Home Partition): Sourced from `/disk/home/` chunk manifest; writes persist directly into OPFS.
- Current Naming Semantics in `WasmLinuxAdapter.ts`:
  - `rootDiskId`: `root-${options.manifest.id}-${options.desktop}`
  - `homeDiskId`: `home-${options.manifest.id}`

### 2.4 Desktop Selection & Session Lifecycle
- Desktop profiles declared in `desktopProfiles.ts`: `kde-plasma` (Plasma 6), `gnome` (GNOME 48), `xfce` (XFCE 4.20).
- Frontend UI: `DesktopSelector.tsx` provides multi-desktop selection cards and passes `selectedDesktop` to `App.tsx` and `Desktop.tsx`.
- Runtime Adapter: `WasmLinuxAdapter.ts` provisions launchers at `/usr/local/bin/weblinux-gnome-session` and `/usr/local/bin/weblinux-xfce-session`.
- Desktop Switching: `switchDesktop()` executes `sync`, sends `SIGTERM` to desktop processes, purges stale Wayland sockets, and resets `activeOs`.

---

## 3. Discovered Vulnerabilities & Technical Debt

### 3.1 Rootfs Source Resolution Defect
**Problem:** In `WasmLinuxAdapter.ts`, the root disk configuration is:
```typescript
{
  worker: `/disk-worker.js?v=${Date.now()}`,
  url: options.manifest.imageSource.baseUri || '/disk/release/',
  name: rootDiskId,
  reset: !!options.freshRootDisk,
}
```
While `rootDiskId` differs between desktops (`root-debian-kde-plasma`, `root-debian-gnome`, `root-debian-xfce`), all profiles still load chunks from the identical URI (`/disk/release/`). Because the chunks in `/disk/release/` contain only KDE Plasma 6 binaries, GNOME and XFCE cannot boot actual desktop sessions.

### 3.2 RISC-V NOMMU Binary Incompatibility
**Problem:** The Debian GNU/Linux 13 (Trixie) rootfs on `/dev/wda` was compiled for RISC-V NOMMU.
- `plasmashell`, `kwin_wayland`, `konsole`, and `dolphin` exist and execute.
- Standard Debian RISC-V packages in upstream mirrors expect an MMU (`fork()`, virtual memory paging). Attempting to run standard `mutter` or `labwc` binaries compiled for MMU architectures on a NOMMU kernel causes illegal instruction traps or missing symbol failures.
- Dedicated NOMMU-compatible binaries for GNOME and XFCE are not yet bundled into separate disk images.

### 3.3 CI Lockfile Desynchronization
**Problem:** In GitHub Actions run `45370180500`, `npm ci` fails on Ubuntu runners because `package.json` in `apps/web` declared `optionalDependencies` (`@rollup/rollup-linux-x64-gnu`, `@tailwindcss/oxide-linux-x64-gnu`, `lightningcss-linux-x64-gnu`) that are missing from `package-lock.json`. Because `package-lock.json` was generated on Windows without Linux optional dependency entries, `npm ci` refuses to proceed.

### 3.4 Runtime State Transition & Command Execution Robustness
**Problem:**
- `runCommand()` relies on echoing a pseudo-random token (`__rc<id>_$?`). When commands take longer than the timeout or when the shell is in a subshell, command output can be clipped or report incorrect return codes.
- `switchDesktop()` stops the active OS, but does not autonomously boot the target desktop into an active state; it transitions to `stopped` rather than executing the full boot lifecycle for the new desktop.

---

## 4. Unresolved Technical Feasibility Questions

1. **Can GNOME Shell / Mutter run without an MMU?**  
   Mutter and GNOME Shell heavily rely on POSIX `fork()`, GJS (SpiderMonkey JavaScript engine), and shared memory paging. Under Linux NOMMU, `fork()` is unavailable; only `vfork()` is supported. A full GNOME Shell desktop under NOMMU is technically non-trivial without major patchsets.
2. **Can Labwc / XFCE run without an MMU?**  
   Labwc is written in pure C on top of wlroots. Lightweight stacking Wayland compositors (such as Labwc or cage) are far more feasible under NOMMU than Mutter, but still require static or flat binary recompilation against a NOMMU libc (e.g. musl or NOMMU uClibc).

---

## 5. Audit Baseline Matrix

| Component | Status | Source Truth |
|---|---|---|
| Linux Kernel | **OPERATIONAL** | 6.6.0 NOMMU WebAssembly 64-bit |
| Storage Subsystem | **OPERATIONAL** | OPFS ext4 chunks with persistence on `/dev/wdb` |
| KDE Plasma 6 | **OPERATIONAL** | Reference baseline with Konsole, Dolphin, and KWin |
| GNOME 48 Runtime | **BLOCKED** | Architecture defined, launcher in place, packages absent |
| XFCE 4.20 Runtime | **BLOCKED** | Architecture defined, launcher in place, packages absent |
| Multi-Rootfs Sourcing | **INCOMPLETE** | All profiles currently fall back to `/disk/release/` |
| CI Pipeline | **FAILING** | `npm ci` lockfile mismatch on Ubuntu runner |
| Host Browser Stability | **STABILIZED** | Capped WebAssembly.Memory to 4 GiB (`0x10000` pages) |
