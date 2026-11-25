# Phase 2 — Browser Compatibility Audit under `/bin/rv` NOMMU

## 1. Execution Environment Constraints
- **Kernel & Binary Loader:** Linux 6.6.0 `riscv64` (`wasm64_nommu`), `/bin/rv` userland interpreter, `/lib/ld-linux-riscv64-lp64d.so.1` (`lp64d` ABI).
- **Process & Threading:** `clone()` and `futex` are supported; BusyBox `vfork()` fails in some shell backgrounding contexts (`bash` uses `clone()`).
- **Memory Protection (`mmap` / `mprotect`):** Under NOMMU, dynamic `RW -> RX` / `RWX` code generation for JIT engines is unsafe or unsupported.
- **Sandboxing:** Unprivileged Linux user namespaces (`CLONE_NEWUSER`) and `bwrap` / Chromium-style `seccomp-bpf` content sandboxes cannot initialize inside `/debian` or `/ubuntu` chroots without kernel namespace isolation.

## 2. Debian 13 Trixie — Firefox ESR (`153.5.1esr-1~deb13u1`, `riscv64`)
- **Engine:** Gecko + SpiderMonkey (`124` packages, `122.7 MiB` download, `440.5 MiB` installed).
- **JIT Strategy:** Disable SpiderMonkey JIT via `user.js` / `policies.json` (`javascript.options.baselinejit=false`, `javascript.options.ion=false`, `javascript.options.blinterp=false`, `javascript.options.wasm_baselinejit=false`, `javascript.options.wasm_ionjit=false`) and `JS_DISABLE_JIT=1`.
- **Sandbox Strategy:** `MOZ_DISABLE_CONTENT_SANDBOX=1`, `MOZ_DISABLE_GMP_SANDBOX=1`, `MOZ_DISABLE_RDD_SANDBOX=1` (NOMMU chroot lacks userns).
- **Wayland & Graphics:** `MOZ_ENABLE_WAYLAND=1`, `GDK_BACKEND=wayland`; test both `layers.acceleration.force-enabled=false` (software WebRender/Cairo) and Mesa `virpipe` (`GALLIUM_DRIVER=virpipe`).
- **Profile Persistence:** `/home/browser/.mozilla/firefox` backed on `/dev/wdb` (`/debian/root/browser-home`).

## 3. Ubuntu 24.04.5 Noble — Epiphany Web (`46.0-2build1`, `riscv64`)
- **Engine:** WebKitGTK 6 (`libwebkitgtk-6.0-4`) + JavaScriptCoreGTK (`libjavascriptcoregtk-6.0-1`) + GTK4 (`276` packages, `157.2 MiB` download, `591.9 MiB` installed).
- **JIT Strategy:** `JSC_useJIT=0` (JavaScriptCore LLInt interpreter mode).
- **Sandbox Strategy:** `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` (bypasses `bwrap` user-namespace requirement inside NOMMU chroot).
- **Wayland & Graphics:** `GDK_BACKEND=wayland`; test `WEBKIT_DISABLE_DMABUF_RENDERER=1` + software vs `GALLIUM_DRIVER=virpipe` (`rvgpu-0`).
- **Profile Persistence:** `/root/.local/share/epiphany` & `/root/.config/epiphany` on `/dev/wdb`.
