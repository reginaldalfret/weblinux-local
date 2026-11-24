# WEBLINUX LOCAL — PHASE 5.3
# RISC-V 64-BIT NOMMU ARCHITECTURE & USERSPACE COMPATIBILITY AUDIT

**Document ID:** `PHASE5-3-NOMMU-001`  
**Kernel Target:** `vmlinux-wasm64_nommu.wasm` (Linux 6.6.0 SMP)  
**Instruction Set Architecture:** RISC-V 64-bit NOMMU (`rv64imac`)  
**Execution Environment:** Client-Side WebAssembly JIT + SharedArrayBuffer  
**Date:** 2026-11-24  

---

## 1. Architectural Hardware Baseline

WebLinux Local executes a custom 64-bit RISC-V kernel compiled to WebAssembly 64-bit (`wasm64`). This kernel operates in **NOMMU mode** (No Memory Management Unit):

| Parameter | Specification | Practical Constraint |
|---|---|---|
| **Paging / MMU** | None (`CONFIG_MMU=n`) | No page tables, no virtual memory translation per process |
| **Address Space** | Unified Single Physical Memory | All processes share the identical flat 64-bit address space |
| **Process Forking** | `vfork()` only | `fork()` syscall is absent; calling `fork()` returns `ENOSYS` |
| **Executable Format** | ELF / FDPIC (`CONFIG_BINFMT_ELF_FDPIC=y`) | Binaries must be position-independent (PIC) or relocated at load time |
| **Memory Allocation** | `brk()` / contiguous `mmap()` | Cannot map fragmented virtual pages; memory fragmentation causes allocation failure |
| **Stack Guard Pages** | Unsupported | Stack overflows directly corrupt adjacent process heap/bss |

---

## 2. Desktop Environment Architectural Feasibility Under NOMMU

### 2.1 KDE Plasma 6 (Reference Baseline) — Confirmed Feasible
- **Compositor:** `wlserver` (WebAssembly-native Wayland compositor running directly on the host display engine).
- **Tooling:** Upstream Qt6 and KDE Plasma binaries were compiled with NOMMU-aware toolchains and position-independent code (PIC/FDPIC).
- **Multi-tasking:** Spawns helper threads and utilizes `vfork()` + `execve()` for application launches.
- **Status:** **OPERATIONAL & VALIDATED**.

### 2.2 GNOME 48 — Incompatible on NOMMU Without Major Subsystem Refactoring
- **Compositor:** `mutter`.
  - Mutter relies on `fork()` for spawning sandboxed sub-renderers, display config daemons, and session trackers.
  - Requires hardware OpenGL/EGL surface binding that maps virtual address buffers not supported by the NOMMU kernel.
- **Shell Engine:** `gnome-shell`.
  - GNOME Shell is built entirely on GJS (GNOME JavaScript based on Mozilla SpiderMonkey). SpiderMonkey requires an MMU for JIT compilation, virtual memory page allocation (`mprotect()`, `PROT_EXEC`), and garbage collection heap chunk allocation.
- **Status:** **BLOCKED (ARCHITECTURALLY INCOMPATIBLE)**.

### 2.3 XFCE 4.20 & Labwc — Feasible But Blocked on NOMMU Recompilation
- **Compositor:** `labwc`.
  - Labwc is a lightweight stacking Wayland compositor written in pure C based on `wlroots`.
  - Unlike Mutter, Labwc does not depend on heavy JavaScript runtimes or complex multi-process sandbox hierarchies. It can execute on NOMMU systems if compiled against a NOMMU-compatible libc (e.g. musl-nommu).
- **Desktop Shell:** `xfce4-session` / `xfce4-panel`.
  - GTK3/GTK4 components can execute under NOMMU when linked against position-independent libraries and using `vfork()`.
- **Blocker:** Upstream Debian 13 (`deb.debian.org/debian riscv64`) compiles all standard packages assuming MMU availability (`CONFIG_MMU=y`). Standard Debian binary `.deb` packages for `labwc` and `xfce4-session` fail under NOMMU.
- **Status:** **BLOCKED (REQUIRES DEDICATED NOMMU IMAGE)**.

---

## 3. Summary of Architectural Verdict

| Desktop Environment | Compositor | MMU Dependency | Upstream Debian Image Status | Final Verdict |
|---|---|---|---|---|
| **KDE Plasma 6** | `wlserver` / KWin | No | Pre-compiled on `/disk/release/` | **VALIDATED** |
| **GNOME 48** | Mutter (Wayland) | **Yes (Critical)** | Unavailable on upstream disk | **BLOCKED (Incompatible)** |
| **XFCE 4.20** | Labwc (wlroots) | No (with musl) | Unavailable on upstream disk | **BLOCKED (Build Needed)** |
