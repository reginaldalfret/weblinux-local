# WebLinux Local — Phase 6.4: Ubuntu GNOME Acceptance Report

## 1. Acceptance Criteria & Results Matrix

| ID | Verification Requirement | Method / Command | Result | Evidence / Details |
|---|---|---|---|---|
| **AC-01** | Genuine Canonical riscv64 Packages | 401 `.deb` SHA-256 validation | **PASSED** | 100% matched official Canonical `Packages.gz` |
| **AC-02** | Zero Mocked Binaries | `ubuntu which gnome-shell mutter gjs` | **PASSED** | Genuine 64-bit RISC-V ELF executables in `/usr/bin` |
| **AC-03** | Authentic `/etc/os-release` | `ubuntu cat /etc/os-release` | **PASSED** | `PRETTY_NAME="Ubuntu 24.04.5 LTS"`, `VERSION="24.04.5 LTS"` |
| **AC-04** | Architecture & Kernel Telemetry | `ubuntu uname -a` | **PASSED** | `Linux rv 6.6.0 #1 SMP rv riscv64 riscv64 riscv64 GNU/Linux` |
| **AC-05** | 3.0 GiB Virtual Rootfs Mount | `ubuntu df -h` | **PASSED** | `/dev/wda` 2.9G total, 757M used, 2.1G free (27% used) |
| **AC-06** | Persistent Home Mount | `ubuntu df -h` | **PASSED** | `/dev/wdb` 16G total mounted on `/ubuntu/root` |
| **AC-07** | SpiderMonkey & GJS NOMMU Execution | `ubuntu gjs --version` | **PASSED** | `1.80.2` (SpiderMonkey 115 in interpreter mode) |
| **AC-08** | GNOME Shell Version | `ubuntu gnome-shell --version` | **PASSED** | `GNOME Shell 46.0` |
| **AC-09** | Mutter Version | `ubuntu mutter --version` | **PASSED** | `mutter 46.2` |
| **AC-10** | DPKG Package Database Integrity | `ubuntu dpkg -l` | **PASSED** | `gir1.2-mutter-14`, `gnome-shell`, `libmutter-14-0`, `mutter` |
| **AC-11** | D-Bus Machine ID | `ubuntu cat /etc/machine-id` | **PASSED** | `75368b8d3caa42aa8816ddf1c13ea89b` |
| **AC-12** | GSettings Compiled Schemas | `ubuntu gsettings list-schemas` | **PASSED** | `org.gnome.shell`, `org.gnome.shell.keybindings`, etc. |
| **AC-13** | Persistent Storage Write CRUD | `echo ... > /ubuntu/root/file` | **PASSED** | Survives across boots via OPFS `/dev/wdb` block storage |
| **AC-14** | Mutter Wayland Display Startup | `ubuntu /usr/local/bin/ubuntu-gnome-session` | **PASSED** | `libmutter-Message: Running GNOME Shell (using mutter 46.2) as a Wayland display server` |
| **AC-15** | Browser Evidence Capture | Playwright Edge automated tests | **PASSED** | 5 high-resolution PNG screenshots captured |

---

## 2. Screenshot Evidence Index
1. `01-distro-selector-ubuntu.png`: Distribution Selector showing Ubuntu Noble Numbat.
2. `02-ubuntu-gnome-selector.png`: Environment Selector showing Ubuntu GNOME 46 desktop card.
3. `03-ubuntu-gnome-booting.png`: Active boot screen with Linux kernel and ext4 mounting logs.
4. `04-ubuntu-gnome-session.png`: Ubuntu GNOME 46 session running with live display canvas.
5. `05-ubuntu-gnome-terminal.png`: Interactive terminal display with verified guest diagnostics.
