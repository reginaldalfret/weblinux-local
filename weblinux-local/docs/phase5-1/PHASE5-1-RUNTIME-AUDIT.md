# WebLinux Local — Phase 5.1: Real Linux Boot & Desktop Startup Pipeline Audit

**Date:** 2026-11-24  
**Target Environment:** Debian GNU/Linux 13 (Trixie), RISC-V 64-bit NOMMU (`vmlinux-wasm64_nommu.wasm`)  
**Audit Method:** Dynamic live command execution within running Debian guest via WasmLinuxAdapter  

---

## 1. Executive Summary

A comprehensive, low-level inspection of the Debian GNU/Linux 13 userspace and initramfs boot pipeline was conducted. The investigation uncovered the exact startup sequences, filesystem mounts, compositor architectures, and executable availability across desktop environments.

### Key Audit Findings:
1. **Initramfs & Shell Execution:** The system boots via `/init` (BusyBox-based initramfs), which initializes virtual devices, loopback networking (`10.0.5.2`), and mounts the primary block devices:
   - `/dev/wda` (7.8 GB ext4) mounted at `/debian`
   - `/dev/wdb` (15.8 GB ext4) mounted at `/debian/root` (persistent user home)
2. **Userspace Entrypoint (`/bin/debian`):** Invocations into the Debian system occur through `/bin/debian`, a native WebAssembly binary that bind-mounts `/dev`, `/proc`, `/sys`, `/run/wlserver`, and `/run/hostnode` into `/debian` before executing `chroot /debian /bin/bash`.
3. **KDE Plasma 6 Baseline:** `/usr/bin/plasmashell`, `/usr/bin/kwin_wayland`, `/usr/bin/konsole`, and `/usr/bin/dolphin` are pre-compiled and operational on `/dev/wda`, integrated with the native WebAssembly Wayland server `wlserver` (`/run/wlserver`).
4. **GNOME & XFCE Packages:** Neither `gnome-shell`/`mutter` nor `labwc`/`xfce4-session` are pre-installed on the current release disk image `/disk/release/`. Invocations of `which gnome-shell mutter` and `which labwc xfce4-session` return exit code 1 with empty output.
5. **Session Launcher Infrastructure:** Dedicated launcher scripts (`/usr/local/bin/weblinux-gnome-session` and `/usr/local/bin/weblinux-xfce-session`) have been authored to trap missing dependencies deterministically and prevent silent failure or false-positive reporting.

---

## 2. Low-Level Filesystem & Mount Table

Live telemetry extracted from the running guest kernel:

```text
# mount
rootfs on / type rootfs (rw)
none on /proc type proc (rw,relatime)
none on /sys type sysfs (rw,relatime)
none on /dev/pts type devpts (rw,relatime,mode=600,ptmxmode=000)
none on /proc/sys/fs/binfmt_misc type binfmt_misc (rw,relatime)
/dev/wda on /debian type ext4 (rw,noatime)
/dev/wdb on /debian/root type ext4 (rw,noatime)
none on /debian/proc type proc (rw,relatime)
none on /debian/sys type sysfs (rw,relatime)
rootfs on /debian/dev type rootfs (rw)
none on /debian/dev/pts type devpts (rw,relatime,mode=600,ptmxmode=000)
none on /debian/run type tmpfs (rw,relatime)
none on /debian/tmp type tmpfs (rw,relatime,mode=1777)
rootfs on /debian/run/hostnode type rootfs (rw)
rootfs on /debian/run/wlserver type rootfs (rw)
rootfs on /debian/usr/local/bin/desktop type rootfs (rw)
rootfs on /debian/run/rvgpu type rootfs (rw)
rootfs on /debian/run/hostopen type rootfs (rw)

# df -h
Filesystem                Size      Used Available Use% Mounted on
/dev/wda                  7.8G      3.8G      4.0G  49% /debian
/dev/wdb                 15.8G      1.6M     15.8G   0% /debian/root
```

---

## 3. Desktop Startup Script Pipeline

### `/init` Autostart Logic:
```sh
if [ -x /debian/etc/rvwasm/autostart ]; then
    if [ $autostart = 1 ]; then
        export PATH=/sbin:/usr/sbin:/bin:/usr/bin
        /bin/debian true < /dev/null > /dev/console 2>&1
        /bin/debian /etc/rvwasm/autostart < /dev/null > /dev/console 2>&1 &
    fi
fi
```

### `/debian/etc/rvwasm/autostart`:
```sh
#!/bin/bash
exec > /root/autostart.log 2>&1 < /dev/null
exec desktop wayland plasma-native
```

### `/debian/usr/local/bin/desktop`:
The script sets up environment variables (`XDG_RUNTIME_DIR=/tmp/runtime-root`, `XDG_SESSION_TYPE=wayland`, `WAYLAND_DISPLAY=wayland-0`), checks if `wlserver` is listening, and launches the target client:
- For KDE: starts `plasmashell --no-respawn` and registers window surfaces on `rv-display`.
- For custom sessions: executes the client under `client "$@"`.

---

## 4. Binary Discovery Audit Table

| Executable | Expected Role | Guest Path | Return Code | Actual Output / Status |
|---|---|---|---|---|
| `kwin_wayland` | KDE Wayland Window Manager | `/usr/bin/kwin_wayland` | 0 | Found (Qt 6.8 build) |
| `plasmashell` | KDE Plasma Desktop Shell | `/usr/bin/plasmashell` | 0 | Found & Executing (PID 119) |
| `konsole` | KDE Terminal Emulator | `/usr/bin/konsole` | 0 | Found (Qt 6.8, version 24.12.0) |
| `dolphin` | KDE File Manager | `/usr/bin/dolphin` | 0 | Found (Qt 6.8, version 24.12.0) |
| `Xwayland` | X11 Compatibility Server | `/usr/bin/Xwayland` | 0 | Found (version 24.1.0) |
| `weston` | Wayland Reference Compositor | `/usr/bin/weston` | 0 | Found |
| `gnome-shell` | GNOME Desktop Shell | N/A | 1 | **NOT_FOUND** (Package not in rootfs) |
| `mutter` | GNOME Wayland Compositor | N/A | 1 | **NOT_FOUND** (Package not in rootfs) |
| `nautilus` | GNOME File Manager | N/A | 1 | **NOT_FOUND** (Package not in rootfs) |
| `labwc` | XFCE wlroots Compositor | N/A | 1 | **NOT_FOUND** (Package not in rootfs) |
| `xfce4-session` | XFCE Session Manager | N/A | 1 | **NOT_FOUND** (Package not in rootfs) |
| `xfce4-panel` | XFCE Panel | N/A | 1 | **NOT_FOUND** (Package not in rootfs) |
| `thunar` | XFCE File Manager | N/A | 1 | **NOT_FOUND** (Package not in rootfs) |
| `xfce4-terminal`| XFCE Terminal Emulator | N/A | 1 | **NOT_FOUND** (Package not in rootfs) |

---

## 5. Architectural Verdict

The WebLinux Local runtime is a genuine Linux system running on RISC-V 64-bit NOMMU WebAssembly emulation. KDE Plasma 6 is the fully functional reference baseline. GNOME 48 and XFCE 4.20 have complete session launcher and runtime architecture specifications in place, but live execution is blocked until the corresponding Debian packages are added to the disk image.
