# WEBLINUX LOCAL — PHASE 5.5
# APPLICATION INTEGRATION SPECIFICATION & AUDIT

**Document ID:** `PHASE5-5-APP-001`  
**Target Desktop:** KDE Plasma 6 (Reference Baseline)  
**Compositor:** Wayland (`wlserver` / KWin)  
**Date:** 2026-11-24  

---

## 1. Verified Linux GUI Applications

### 1.1 Konsole Terminal Emulator
- **Binary:** `/usr/bin/konsole`
- **Execution Environment:** Debian GNU/Linux 13 (Trixie) riscv64 NOMMU userspace.
- **Wayland Display Integration:** Connects to Wayland display socket `/tmp/runtime-root/wayland-0`.
- **Keyboard & Shell Pipeline:** Interactive PTY session (`/dev/pts/0`), command execution, and standard output streaming verified.
- **Window Management:** Supports Wayland window move, resize, minimize, maximize, and clean process termination on window close.

### 1.2 Dolphin File Manager
- **Binary:** `/usr/bin/dolphin`
- **Execution Environment:** Qt6 / KDE Frameworks 6 over Wayland.
- **Filesystem Operations:** Full CRUD operations on persistent ext4 partition `/dev/wdb` (`/debian/root`).
- **Safety Policy:** Operates exclusively in sandboxed test paths (`/root/WebLinux-Phase5-Tests/`). Real user data is strictly protected from destructive actions.

---

## 2. GNOME and XFCE Application Status

| Application | Desktop | Binary Path | Status | Cause |
|---|---|---|---|---|
| Nautilus | GNOME 48 | `/usr/bin/nautilus` | **BLOCKED** | Binary missing from NOMMU release disk image |
| GNOME Terminal | GNOME 48 | `/usr/bin/gnome-terminal` | **BLOCKED** | Binary missing from NOMMU release disk image |
| Thunar | XFCE 4.20 | `/usr/bin/thunar` | **BLOCKED** | Binary missing from NOMMU release disk image |
| XFCE Terminal | XFCE 4.20 | `/usr/bin/xfce4-terminal` | **BLOCKED** | Binary missing from NOMMU release disk image |
