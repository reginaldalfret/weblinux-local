# WEBLINUX LOCAL — PHASE 5.3
# PACKAGE DEPENDENCY & BINARY AUDIT MATRIX

**Document ID:** `PHASE5-3-PKG-001`  
**Distribution:** Debian GNU/Linux 13 (Trixie)  
**Guest Architecture:** RISC-V 64-bit NOMMU (`rv64imac`)  
**Date:** 2026-11-24  

---

## 1. Package Dependency Tree Audit

### 1.1 KDE Plasma 6 (Reference Profile)
Verified directly inside the guest filesystem (`/debian`):

| Package / Binary | Path | Architecture | NOMMU Status | Source |
|---|---|---|---|---|
| `plasmashell` | `/opt/nq/plasmashell` | riscv64 | Confirmed compatible | `/disk/release/` chunk 21dd63... |
| `kwin_wayland` | `/usr/bin/kwin_wayland` | riscv64 | Confirmed compatible | `/disk/release/` |
| `konsole` | `/usr/bin/konsole` | riscv64 | Confirmed compatible | `/disk/release/` |
| `dolphin` | `/usr/bin/dolphin` | riscv64 | Confirmed compatible | `/disk/release/` |
| `wlserver` | `/usr/lib/wlserver/desktop` | wasm64/host | Native display bridge | `initrd.img` |

---

### 1.2 GNOME 48 (Alternative Profile)
Audited against Debian 13 Trixie package pool:

| Package / Binary | Version | Architecture | NOMMU Compatibility | Source | Audit Result |
|---|---|---|---|---|---|
| `gnome-shell` | 48.0-1 | riscv64 | **Incompatible** (SpiderMonkey gjs requires MMU) | Debian Trixie | **BLOCKED** |
| `mutter` | 48.0-1 | riscv64 | **Incompatible** (Requires POSIX `fork()`) | Debian Trixie | **BLOCKED** |
| `nautilus` | 48.0-1 | riscv64 | Unconfirmed (GLib/GIO file operations) | Debian Trixie | **BLOCKED** |
| `gnome-console` | 48.0-1 | riscv64 | Unconfirmed (VTE terminal widget) | Debian Trixie | **BLOCKED** |
| `dconf-service` | 0.40.0-4 | riscv64 | Compatible with D-Bus IPC | Debian Trixie | **BLOCKED** |

---

### 1.3 XFCE 4.20 (Alternative Profile)
Audited against Debian 13 Trixie package pool:

| Package / Binary | Version | Architecture | NOMMU Compatibility | Source | Audit Result |
|---|---|---|---|---|---|
| `labwc` | 0.8.0-1 | riscv64 | Feasible (C/wlroots, requires NOMMU libc) | Debian Trixie | **BLOCKED** |
| `xfce4-session` | 4.20.0-1 | riscv64 | Feasible (GTK3/vfork) | Debian Trixie | **BLOCKED** |
| `xfce4-panel` | 4.20.0-1 | riscv64 | Feasible (GTK3 layer-shell) | Debian Trixie | **BLOCKED** |
| `thunar` | 4.20.0-1 | riscv64 | Feasible (GTK3/vfork) | Debian Trixie | **BLOCKED** |
| `xfce4-terminal` | 1.1.3-1 | riscv64 | Feasible (VTE/vfork) | Debian Trixie | **BLOCKED** |

---

## 2. Conclusion

Standard upstream Debian 13 binary repositories build for generic `riscv64` with virtual memory (`CONFIG_MMU=y`). Only the KDE Plasma 6 stack present in `/disk/release/` has been compiled and packaged for the specific NOMMU execution environment of WebLinux Local. GNOME 48 and XFCE 4.20 must accurately remain categorized as `BLOCKED` until dedicated NOMMU rootfs images are produced.
