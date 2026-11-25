# WebLinux Local — Phase 6.5 (Phase A): Ubuntu 24.04.5 LTS KDE Plasma Package Feasibility Analysis

**Distribution:** Ubuntu 24.04.5 LTS (Noble Numbat)  
**Architecture:** `riscv64`  
**Source Repositories:** `ports.ubuntu.com/ubuntu-ports/` (`noble`, `noble-updates`, `main` & `universe`)  
**Closure Metadata:** `.phase6-build/ubuntu-kde/package-metadata/kde-resolved-closure.json`

---

## 1. Key Package Versions Discovered (Ubuntu Noble `riscv64`)

Unlike Debian 13 Trixie (which ships KDE Plasma 6.3 / Qt 6.8), Ubuntu 24.04 LTS Noble ships **KDE Plasma 5.27 LTS** built on **Qt 5.15.13** and **KDE Frameworks 5.115.0**:

| Component | Ubuntu Noble Package | Version | Arch | Compressed Size |
|---|---|---|---|---|
| **Plasma Workspace** | `plasma-workspace` | `4:5.27.12-0ubuntu0.1` | `riscv64` | 11,818.1 KiB |
| **Plasma Desktop** | `plasma-desktop` | `4:5.27.12-0ubuntu0.1` | `riscv64` | 1,369.3 KiB |
| **KWin Wayland** | `kwin-wayland` | `4:5.27.11-0ubuntu3` | `riscv64` | 612.9 KiB |
| **KWin Common** | `kwin-common` | `4:5.27.11-0ubuntu3` | `riscv64` | 2,720.2 KiB |
| **Konsole** | `konsole` | `4:23.08.5-0ubuntu4` | `riscv64` | 1,270.9 KiB |
| **Dolphin** | `dolphin` | `4:23.08.5-0ubuntu4` | `riscv64` | 4,431.7 KiB |
| **System Settings** | `systemsettings` | `4:5.27.11-0ubuntu2` | `riscv64` | 369.2 KiB |
| **Breeze Theme** | `breeze` | `4:5.27.12-0ubuntu0.1` | `riscv64` | 70,988.0 KiB |
| **Breeze Icons** | `breeze-icon-theme` | `4:5.115.0-0ubuntu3` | `all` | 3,069.5 KiB |
| **Qt 5 Wayland** | `qtwayland5` | `5.15.13-1` | `riscv64` | 209.7 KiB |
| **Qt 6 Wayland** | `qt6-wayland` | `6.4.2-5build3` | `riscv64` | 123.8 KiB |
| **KIO** | `kio` | `5.115.0-0ubuntu6` | `riscv64` | 3,324.9 KiB |
| **KIO Extras** | `kio-extras` | `4:23.08.5-0ubuntu5` | `riscv64` | 642.6 KiB |
| **Plasma Framework** | `plasma-framework` | `5.115.0-0ubuntu4` | `riscv64` | 2,718.1 KiB |
| **Xwayland** | `xwayland` | `2:23.2.6-1ubuntu0.8` | `riscv64` | 1,044.8 KiB |
| **D-Bus X11** | `dbus-x11` | `1.14.10-4ubuntu4.1` | `riscv64` | 23.1 KiB |

*(Note: `libqt6widgets6` and `kf6-kconfig-bin` are Debian Trixie / Qt6-era names; Noble uses `libqt5widgets5t64` and `libkf5config-bin`.)*

---

## 2. Transitive Dependency Closure Summary
- **Packages to Install (excluding base Ubuntu 24.04.5):** **743 `.deb` packages**
- **Total Download Size:** **373.53 MiB**
- **Total Installed Size:** **1,181.03 MiB** (~1.15 GiB)
- **Unresolved / Missing Dependencies:** **0** (`[]`)

---

## 3. Compatibility & Architectural Assessment
1. **No SpiderMonkey JIT / GJS Dependency:** Unlike GNOME Shell 46 (which relies on GJS + SpiderMonkey 115), KDE Plasma 5.27 uses compiled C++ + Qt 5 Quick (`QT_QUICK_BACKEND=software`), avoiding `JS_DISABLE_JIT=1` interpreter overhead.
2. **Qt 5 / Plasma 5.27 Software Rendering:** Qt Quick 2 (`QT_QUICK_BACKEND=software`, `QMLSCENE_DEVICE=softwarecontext`, `LIBGL_ALWAYS_SOFTWARE=1`) renders directly into Wayland `wl_shm` buffers without requiring `vrend.wasm` or kernel DRM/KMS.
3. **`wlserver` Protocol Compatibility:** `initramfs-staging/usr/lib/wlserver/` natively implements `WLSERVER_SHELL=plasma` (`kwin.js`, `plasmashell.js`, `layershell.js`, `PLASMA-PROTOCOL.md`), explicitly supporting Plasma 5 and Plasma 6 clients over `/tmp/runtime-root/wayland-0`.
4. **Known Risks:**
   - **QML JIT (V4):** Qt 5 QML's V4 engine can attempt `PROT_EXEC` JIT allocation under NOMMU; `QV4_FORCE_INTERPRETER=1` disables V4 JIT safely if needed.
   - **Disk Capacity:** 1.18 GiB installed + ~75 MiB base = ~1.26 GiB raw rootfs; a **3.0 GiB** ext4 virtual disk provides >1.7 GiB headroom.
