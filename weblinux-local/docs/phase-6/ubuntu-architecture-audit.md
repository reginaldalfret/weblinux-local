# WEBLINUX LOCAL — PHASE 6.0
# UBUNTU 24.04 LTS (NOBLE NUMBAT) ARCHITECTURE & PIPELINE AUDIT

**Document ID:** `PHASE6-0-ARCH-AUDIT-001`  
**Workspace:** `E:\Web-Linux\weblinux-local`  
**Branch:** `feature/ubuntu-24.04-noble`  
**Target Architecture:** RISC-V 64-bit NOMMU (`wasm64_nommu`) + User-mode RISC-V Emulation (`/bin/rv`)  
**Target Distribution:** Ubuntu 24.04 LTS (Noble Numbat)  
**Baseline Distribution:** Debian GNU/Linux 13 (Trixie) + KDE Plasma 6  
**Date:** 2026-11-24  
**Audit Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

This architecture audit investigates the end-to-end boot, storage, and distribution orchestration pipeline of WebLinux Local to determine the precise technical modifications required to introduce **Ubuntu 24.04 LTS (Noble Numbat)** as an independent, fully functional Linux distribution alongside the existing Debian 13 (Trixie) reference baseline.

### Key Audit Findings:
1. **Existing Ubuntu Manifest Status:** The existing [`public/manifests/ubuntu.json`](file:///E:/Web-Linux/weblinux-local/apps/web/public/manifests/ubuntu.json) is **metadata-only and completely non-operational**. It references non-existent local URIs (`/images/ubuntu/`), missing upstream endpoints (returning HTTP 404), placeholder chunk counts (`8192`), and is guarded by `validationStatus: "experimental"`, which intentionally disables selection in the UI and causes a fatal launch rejection in [`App.tsx`](file:///E:/Web-Linux/weblinux-local/apps/web/src/App.tsx).
2. **Distribution Selection & Boot Pipeline:** The boot orchestration in [`WasmLinuxAdapter.ts`](file:///E:/Web-Linux/weblinux-local/runtime/adapters/WasmLinuxAdapter.ts) already possesses a modular disk configuration model (`root-${manifest.id}-${desktop}` and `home-${manifest.id}`), but the underlying guest initialization script (`/init`) is tightly coupled to `/debian`.
3. **Execution Architecture Reality:** The WebLinux guest execution model is a dual-tier architecture:
   - **Tier 1 (Kernel Space):** Custom Linux kernel (`Linux version 7.0.0+`) compiled to WebAssembly 64-bit NOMMU (`vmlinux-wasm64_nommu.wasm`) with `CONFIG_MMU=n` (`mm/nommu.c`).
   - **Tier 2 (Userspace Emulation):** A native WebAssembly RISC-V 64-bit emulator (`/bin/rv`) registered in `/init` via Linux `binfmt_misc` for all `riscv64` ELF binaries. `/bin/rv` implements an emulated memory management unit (`rv_mm_mmap`, `rv_fork_snapshot`, `rv_fork_resume`, `rv_thread_clone`) that translates syscalls and provides virtual memory semantics to emulated RISC-V userspace processes.
4. **Rootfs Delivery Pipeline:** Disk images are chunked into 1 MiB (`1048576` bytes) binary blocks loaded on-demand via [`disk-worker.js`](file:///E:/Web-Linux/weblinux-local/apps/web/public/disk-worker.js), proxied through Vite middleware (`.disk-cache/`), and persistently cached in the Origin Private File System (OPFS).

---

## 2. Detailed Audit of Existing Manifest Pipeline

### 2.1 Manifest Loading Flow
When WebLinux Local starts in the browser:
1. [`App.tsx`](file:///E:/Web-Linux/weblinux-local/apps/web/src/App.tsx) executes a `useEffect` on mount that triggers `adapter.loadManifest(id)` for each candidate distribution ID (`debian`, `ubuntu`, `fedora`, `arch`, `kali-lab`).
2. Manifests are retrieved from `/manifests/<distro>.json`.
3. [`DistributionSelector.tsx`](file:///E:/Web-Linux/weblinux-local/apps/web/src/pages/DistributionSelector.tsx) renders the distribution cards and enforces the following gate:
   ```typescript
   const isValidated = distro.validationStatus === 'validated';
   ...
   onClick={() => {
     if (isValidated) onSelect(distro.id);
   }}
   ```
4. Only distributions with `validationStatus === 'validated'` can be selected.
5. In [`App.tsx`](file:///E:/Web-Linux/weblinux-local/apps/web/src/App.tsx), `handleLaunch` performs an independent pre-flight check:
   ```typescript
   if (activeManifest.validationStatus !== 'validated') {
     throw new Error(
       `${activeManifest.name} is currently an unvalidated port (status: ${activeManifest.validationStatus.toUpperCase()}). To protect your environment, only validated distributions (Debian GNU/Linux 13) can be launched.`
     );
   }
   ```

### 2.2 Inspection of `public/manifests/ubuntu.json`
Analysis of the current Ubuntu manifest shows that every operational property is dummy metadata:

| Field | Current Manifest Value | Operational Reality | Audit Assessment |
|---|---|---|---|
| `id` | `"ubuntu"` | Expected by adapter | Valid identifier |
| `name` | `"Ubuntu Noble Numbat (RISC-V Port)"` | Display title | Valid title |
| `releaseVersion` | `"24.04 LTS"` | Display version | Accurate target |
| `architecture` | `"riscv64"` | Matches target ABI | Accurate |
| `kernelCompatibility` | `"linux-wasm64_nommu-6.1"` | Actual kernel is 7.0.0+ | Outdated label |
| `defaultDesktop` | `"icewm"` | Not packaged in image | Placeholder |
| `supportedDesktops` | `["icewm", "kde-plasma"]` | No desktop binaries on disk | Unverified |
| `filesystemLayout.rootMount` | `"/ubuntu"` | Guest `/init` uses `/debian` | Hardcoded mismatch |
| `imageSource.baseUri` | `"/images/ubuntu/"` | Directory does not exist | **BROKEN (404)** |
| `imageSource.id` | `"ubuntu-24-04-riscv64-candidate"` | Arbitrary string | Non-functional |
| `integrity.chunksCount` | `8192` | Dummy count (8 GiB) | Placeholder |
| `validationStatus` | `"experimental"` | Blocks UI selection | Correctly prevents failure |

**Conclusion:** The existing `ubuntu.json` cannot boot. It is an unverified placeholder that must be re-engineered with verified chunk manifests, authentic image sources, and real integrity checksums.

---

## 3. End-to-End Boot Orchestration Pipeline

```
+-----------------------------------------------------------------------------+
| Browser UI: React + TypeScript (App.tsx / DistributionSelector.tsx)         |
|  - User selects Ubuntu 24.04 LTS (Noble Numbat)                             |
|  - Validates manifest: activeManifest.validationStatus === 'validated'       |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| WasmLinuxAdapter.ts (Lifecycle State Machine: uninitialized -> ready)       |
|  - Pre-flight SHA-256 verification of kernel & initramfs binaries            |
|  - Compiles vmlinux-wasm64_nommu.wasm via WebAssembly.compile()             |
|  - Configures disk subsystem with isolated root & persistent home:           |
|      rootDiskId = "root-ubuntu-24.04-default" (/dev/wda)                     |
|      homeDiskId = "home-ubuntu" (/dev/wdb)                                  |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| WebAssembly Kernel Engine (vmlinux-wasm64_nommu.wasm, Linux 7.0.0+ NOMMU)   |
|  - Memory: 2048 MiB shared memory pool (wasm_pool=3..4 threads)             |
|  - Mounts root=/dev/ram0 (initramfs-wasm64_nommu.cpio.gz)                   |
|  - Executes /init (Native wasm BusyBox script)                              |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| Guest /init Script Execution (initramfs)                                    |
|  1. Mounts /proc, /sys, /dev, /tmp, /run, /dev/shm                          |
|  2. Mounts binfmt_misc and registers /bin/rv emulator for riscv64 ELF       |
|  3. Probes /sys/block/wda/dev -> creates /dev/wda -> mounts ext4 rootfs     |
|  4. Probes /sys/block/wdb/dev -> creates /dev/wdb -> mounts ext4 home       |
|  5. Executes distribution supervisor script (/bin/ubuntu or /bin/debian)    |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| Distribution Supervisor & Userspace Execution                               |
|  - Chroots into target rootfs (/ubuntu)                                     |
|  - Executes riscv64 ELF binaries (bash, dash, coreutils, dpkg, apt)         |
|  - binfmt_misc passes ELF execution to native /bin/rv WebAssembly emulator   |
|  - /bin/rv emulates rv64imafdc instructions and translates Linux syscalls   |
|  - Interactive terminal or graphical Wayland display active                  |
+-----------------------------------------------------------------------------+
```

---

## 4. Guest Rootfs Provisioning & Storage Architecture

### 4.1 Block Device Virtualization (`disk-worker.js`)
1. **Virtual Disks:**
   - `/dev/wda` (Major 254, Minor 0): Root filesystem ext4 block device. Read-only image source chunking with copy-on-write overlay.
   - `/dev/wdb` (Major 254, Minor 16): Persistent user storage block device (`home`). Initialized from template on first boot, backed by OPFS.
2. **Chunk Delivery Mechanism:**
   - Images are sliced into 1,048,576 byte (1 MiB) chunks named `000000`, `000001`, `000002`, etc.
   - A chunk manifest (`manifest.json`) defines total block count, chunk hashes, and boot chunk list (`boot: [...]`).
   - `disk-worker.js` intercepts block read/write requests from the kernel driver (`wasm_blk.c`), reading from OPFS if present, or synchronously fetching the missing chunk via HTTP from `baseUri`.
3. **Vite Development Proxy:**
   - [`vite.config.ts`](file:///E:/Web-Linux/weblinux-local/apps/web/vite.config.ts) intercepts requests under `/disk/*`.
   - Chunks are cached in `apps/web/.disk-cache/` to ensure offline capability and fast subsequent boots.

### 4.2 Decoupling Rootfs from Debian-Specific Assumptions
In the current baseline:
- `/init` hardcodes `mkdir -p /debian; mount -t ext4 -o noatime /dev/wda /debian`.
- `/bin/debian` hardcodes `D=/debian; if [ ! -x $D/usr/bin/bash ]; ...`.
- Persistent home initialization checks `[ -d /debian/root ]` and mounts `/dev/wdb` at `/debian/root`.

**Required Adaptation for Ubuntu:**
To support Ubuntu 24.04 without breaking Debian 13:
1. Dynamic Distribution Root: The target distribution mountpoint must be determined dynamically (e.g. from kernel commandline `distro=ubuntu` or by inspecting `/dev/wda` root marker `/etc/os-release`).
2. Dual Supervisor Scripts: Provide `/bin/ubuntu` in initramfs alongside `/bin/debian` (or a unified `/bin/distro-enter` that respects `ID=ubuntu` vs `ID=debian`).
3. Root Disk Namespacing: Root disks must remain strictly isolated:
   - Debian Root: `root-debian-kde-plasma`
   - Ubuntu Root: `root-ubuntu-24.04-default`
4. Persistent Storage Namespacing:
   - Debian Home: `home-debian`
   - Ubuntu Home: `home-ubuntu`
   This guarantees complete data isolation and prevents OPFS data corruption across distribution switches.

---

## 5. Summary of Architecture Audit

| Subsystem | Baseline State (Debian 13) | Current Ubuntu State | Required Engineering Action |
|---|---|---|---|
| **Manifest** | Validated, operational | Metadata-only placeholder | Generate authentic `ubuntu-24.04.json` with chunk hashes |
| **Kernel** | `vmlinux-wasm64_nommu.wasm` | Identical kernel reused | Kernel is distribution-agnostic; no changes needed |
| **Initramfs** | `/init` hardcodes `/debian` | Incompatible with `/ubuntu` | Add dynamic rootfs detection and `/bin/ubuntu` wrapper |
| **Binary Runner** | `/bin/rv` registered via binfmt | Supports standard riscv64 | Verified compatible with riscv64 LP64D ELF binaries |
| **Disk Worker** | Reads `/disk/release/` | Points to 404 `/images/ubuntu/` | Host chunked Ubuntu rootfs under `/disk/ubuntu-24.04/` |
| **Persistence** | `/dev/wdb` (`home-debian`) | Not implemented | Isolate to `home-ubuntu` on `/dev/wdb` |
| **UI Selection** | Enabled and validated | Disabled (`experimental`) | Enable when rootfs chunks and hashes pass validation |
