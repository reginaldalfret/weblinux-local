# Phase 11 — Performance Comparison

| Metric | Ubuntu 24.04 KDE 5.27 | Arch Linux KDE 6.8.3 | openSUSE KDE 6.8.2 | Fedora 45 KDE 6.7.4 (`task-9022`) |
|---|---|---|---|---|
| **Cold Boot (`shellReady`)** | `25s` (`23s` P7) | `23.5s` | `21.7s` | `28.0s` |
| **Warm Boot (`shellReady`)** | `36s` | `33.9s` | `55.9s` | `39.2s` |
| **Guest RAM Used** | `~979–1101 MiB` / `2009 MiB` | `1026 MiB` / `2009 MiB` | `904 MiB` / `2009 MiB` | `865 MiB` / `2009 MiB` |
| **Root Disk Size** | Isolated `root-ubuntu-kde` | `5.0 GiB` (`3.6 GiB` used) | `5.6 GiB` (`4.1 GiB` used) | `3.3 GiB` (`1.69 GiB` used, `1927` chunks) |
| **Package Manager** | `apt` | `pacman 7.1.0` (`555` pkgs) | `zypper 1.14.102` (`1697` pkgs) | `dnf5 5.4.3.0` (`717` pkgs) |
| **RVGPU / Rendering** | `vrend-webgl2` (`149` records) | `gpuserver` + software QML | `gpuserver` + software QML | `gpuserver` + software QML |
