# WebLinux Local Architecture Decision Record & System Design

## 1. Vision & Technical Manifesto

WebLinux Local is an autonomous, client-side, browser-executed operating system platform.
Unlike terminal-in-a-box simulations or server-streamed virtual machines (VNC/RDP), WebLinux Local executes an authentic Linux kernel and native userspace directly on the visitor's CPU and GPU via WebAssembly (wasm64), WebGL2/WebGPU, and Web Workers.

---

## 2. Architectural Layers

```
┌────────────────────────────────────────────────────────────────────────┐
│                   WebLinux Frontend (React + Vite + TS)                │
│  Landing  │  Checker  │  Distro Selector  │  Desktop UI  │  Storage UI  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         IRuntimeAdapter Interface
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    WebLinux Runtime Manager Subsystem                   │
│  - Lifecycle controller (Init, Boot, Pause, Resume, Shutdown)         │
│  - Distribution Manifest Registry & Chunk Hash Verifier                │
│  - OPFS Storage Coordinator & Backup/Export Engine                     │
│  - Network Safety Boundary & Token Bucket Rate Limiter                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                 Client-Side Hardware Emulation Subsystem               │
│                                                                        │
│   SharedArrayBuffer (4-16 GiB Memory64, Atomics Synchronization)       │
│                                                                        │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────┐ │
│   │  Linux Kernel       │  │  Wayland Compositor │  │  GPU Executor  │ │
│   │  (wasm64_nommu)     │  │  (wlserver on V8)   │  │  (vrend/virgl) │ │
│   │  Multi-worker pool  │  │  Surface Presenter  │  │  WebGL2/WebGPU │ │
│   └──────────┬──────────┘  └──────────┬──────────┘  └────────┬───────┘ │
│              │                        │                      │         │
│   ┌──────────▼──────────┐  ┌──────────▼──────────┐  ┌────────▼───────┐ │
│   │  OPFS Block Device  │  │  AudioWorklet       │  │  RV64 JIT      │ │
│   │  (1 MiB chunks)     │  │  (PulseAudio/Wasm)  │  │  (rv JIT engine│ │
│   └─────────────────────┘  └─────────────────────┘  └────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Subsystems

### 3.1 Kernel & Process Model
- **Kernel Architecture:** Linux kernel compiled to 64-bit WebAssembly (`wasm64_nommu`) based on Joel Severin's `linux-wasm` with custom patches (atomic compare-and-swap, signal delivery, memory sizing, sound device).
- **Execution Model:** NOMMU (No Memory Management Unit). All guest processes share a single `WebAssembly.Memory` backed by a `SharedArrayBuffer`.
- **Concurrency:** Every Linux task executes in its own dedicated Web Worker; tasks coordinate through kernel scheduling and `Atomics.wait` / `Atomics.notify`.
- **Process Creation:** `posix_spawn` / `vfork` are supported; traditional copy-on-write `fork()` is replaced by fast thread-spawn semantics.

### 3.2 RISC-V Binary Translation (rv JIT)
- Linux userspace programs are standard Debian `riscv64` ELF binaries.
- The `rv` user-mode translation engine interprets cold code and JIT-compiles hot code blocks into WebAssembly modules.
- Translations are cached in the browser's Origin Private File System (`jitcache.bin`), eliminating re-translation costs on subsequent visits.

### 3.3 Graphical Display & Wayland Compositing
- A custom JavaScript Wayland compositor (`wlserver`) executes as a guest process on the browser's JavaScript engine (`hostnode`).
- Client windows render into shared-memory buffers.
- The frontend composites window surfaces directly to an HTML5 canvas using WebGL2 shaders with zero-copy texture transfers where supported.
- Complete pointer lock, multi-touch, XKB keyboard layout translation, and bidirectional clipboard integration are provided.

### 3.4 Persistent Storage & OPFS Block Device
- Ext4 disk images are cut into uniform 1 MiB chunks.
- Chunks are fetched on-demand over HTTP/HTTPS with SHA-256 integrity verification.
- Downloaded and locally written blocks are persisted in the browser's Origin Private File System (OPFS) using `FileSystemSyncAccessHandle` inside dedicated disk workers.
- The user's `/home` filesystem is mounted as an independent persistent disk, ensuring personal files survive system updates and cache resets.

### 3.5 Network Safety & Relay Architecture
- By default, WebLinux operates 100% offline and browser-local.
- When networking is enabled, traffic is tunneled through a restricted WebSocket relay (`rvRelay`) to an isolated TAP device.
- Strict firewall filtering blocks private subnets (RFC 1918), link-local addresses (cloud metadata), unauthorized ports, and unauthorized domain lookups, protecting the user and operator against SSRF and botnet misuse.

---

## 4. Distribution Validation Roadmap

1. **Debian (riscv64) - Target: Phase 3 [Production / Validated]**
   - Base release: Debian trixie (riscv64).
   - Validated desktops: KDE Plasma 6 (primary native shell), IceWM (lightweight fallback).
2. **Ubuntu - Target: Phase 5 [Experimental Investigation]**
   - RISC-V 64 rootfs compatibility audit with linux-wasm syscall limits.
3. **Fedora - Target: Phase 5 [Experimental Port]**
   - Evaluation of RISC-V minimal rootfs and RPM package manager behavior under NOMMU.
4. **Arch Linux - Target: Phase 5 [Experimental Port]**
   - Evaluation of Arch Linux RISC-V port and pacman package management under NOMMU.
5. **Kali Linux (Lab Variant) - Target: Phase 5 [Security-Lab Image]**
   - Clearly marked unofficial security-lab image built on Debian riscv64 verified tooling.
