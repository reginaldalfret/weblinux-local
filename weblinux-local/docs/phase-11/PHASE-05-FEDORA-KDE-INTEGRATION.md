# Phase 11 — Fedora 45 KDE Plasma 6 Integration

## 1. Installed KDE Components (`fc45`)

- `plasma-workspace-0:6.7.4-1.fc45.riscv64`
- `plasma-desktop-0:6.7.4-1.fc45.riscv64`
- `kwin-0:6.7.4-2.fc45.riscv64`
- `qt6-qtbase-0:6.11.1-5.fc45.riscv64`, `qt6-qtwayland-0:6.11.1-2.fc45.riscv64`
- `dolphin-0:26.08.0-1.fc45.riscv64`, `konsole-0:26.08.0-1.fc45.riscv64`
- `plasma-breeze-0:6.7.4-2.fc45.riscv64`, `breeze-icon-theme-0:6.29.0-1.fc45.noarch`
- `f45-backgrounds-base`, `f45-backgrounds-kde`

## 2. Security & Account Configuration

- `passwd -l root` applied during build so no known default password remains active.
- WebLinux BusyBox `/init` boots directly into the Wayland session without requiring systemd as PID 1.
