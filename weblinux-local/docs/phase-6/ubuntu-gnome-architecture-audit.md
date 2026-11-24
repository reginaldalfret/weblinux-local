# WebLinux Local — Phase 6.4: Ubuntu 24.04.5 LTS GNOME 46 Architecture Audit

## 1. Executive Summary
Phase 6.4 evaluates and implements the graphical desktop runtime for Ubuntu 24.04.5 LTS (Noble Numbat) on the WebLinux Local execution platform.
WebLinux Local executes guest operating systems on top of a RISC-V 64-bit NOMMU Linux kernel (6.6.0) compiled to WebAssembly, paired with the `/bin/rv` userland syscall translator, a WebGL2 display pipeline, and an OPFS-backed virtual ext4 block device layer.

Following the project's strict mandate:
- **Primary Mission:** Implement authentic Ubuntu 24.04.5 LTS GNOME 46 using Canonical's official Noble riscv64 userspace packages.
- **Verification Standard:** Zero mocked desktop UI, genuine ELF binaries, cryptographic package verification, and live browser execution telemetry.

---

## 2. Desktop Stack Architecture

### 2.1 Core Desktop Components
| Layer | Upstream Component | Ubuntu Noble Package Version | RISC-V Binary Path |
|---|---|---|---|
| **Compositor / Window Manager** | Mutter | `46.2-1ubuntu0.24.04.18` (riscv64) | `/usr/bin/mutter` |
| **Compositor Core Library** | Libmutter-14 | `46.2-1ubuntu0.24.04.18` (riscv64) | `/usr/lib/riscv64-linux-gnu/libmutter-14.so.0` |
| **Desktop Shell** | GNOME Shell | `46.0-0ubuntu6~24.04.17` (riscv64) | `/usr/bin/gnome-shell` |
| **JavaScript Runtime** | GJS / SpiderMonkey 115 | `1.80.2-1build2` (riscv64) | `/usr/bin/gjs` |
| **IPC Bus Daemon** | D-Bus Daemon | `1.14.10-4ubuntu4.1` (riscv64) | `/usr/bin/dbus-daemon` |
| **X11 Compatibility Server** | Xwayland | `2:23.2.6-1ubuntu0.8` (riscv64) | `/usr/bin/Xwayland` |
| **File Manager** | Nautilus | `1:46.4-0ubuntu0.2` (riscv64) | `/usr/bin/nautilus` |

### 2.2 Execution Path & Pipeline
```
[User Browser: Microsoft Edge]
       │
       ▼
[WebLinux Runtime Engine (Vite + React + TS)]
       │
       ▼
[WasmLinuxAdapter (WASM64 NOMMU Kernel 6.6.0)]
       │
       ├── /dev/wda (3.0 GiB ext4 root-ubuntu-gnome) ──► Mounted at /ubuntu
       ├── /dev/wdb (16.0 GiB ext4 home-ubuntu)      ──► Mounted at /ubuntu/root
       │
       ▼
[/bin/ubuntu Supervisor (Initramfs Bridge)]
       │
       ├── Bind mounts: /run/wlserver (Wayland Display Socket)
       ├── Bind mounts: /run/hostnode (NodeJS Host Bridge)
       ├── Bind mounts: /run/rvgpu (Virgl/Vtest WebGL2 GPU Bridge)
       ├── Pseudo-filesystems: /dev, /proc, /sys, /run, /tmp
       │
       ▼
[/usr/local/bin/ubuntu-gnome-session]
       │
       ├── Environment: GJS_DISABLE_JIT=1 JS_DISABLE_JIT=1 LIBGL_ALWAYS_SOFTWARE=1
       ├── D-Bus Session: dbus-run-session
       │
       ▼
[GNOME Shell 46 & Mutter 46 (Nested Wayland Session)]
```

---

## 3. NOMMU Compatibility & Workarounds

### 3.1 SpiderMonkey 115 & GJS Memory Management
- **MMU Constraint:** SpiderMonkey JIT normally requires `mmap(MAP_ANONYMOUS, PROT_READ|PROT_WRITE|PROT_EXEC)` to generate dynamic native RISC-V instructions (`W^X` memory violation under NOMMU).
- **NOMMU Resolution:** GJS and SpiderMonkey 115 support bytecode interpreter mode. Exporting `GJS_DISABLE_JIT=1` and `JS_DISABLE_JIT=1` disables the baseline and Ion JIT compilers, allowing GJS and GNOME Shell scripts to execute entirely through the interpreter without page protection faults.

### 3.2 Compositor Nesting
- Mutter supports running as a nested Wayland client on an existing display server using `--nested --wayland`.
- The WebLinux platform provides the parent Wayland display server (`wlserver`), allowing Mutter to bind to the browser's WebGL2 display canvas as a client surface while serving child Wayland clients internally.
