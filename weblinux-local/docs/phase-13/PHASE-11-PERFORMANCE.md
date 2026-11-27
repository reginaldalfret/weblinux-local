# Phase 13.11 — Performance & Memory Measurements

**Date:** 2026-11-27  
**Guest Memory Limit:** `2,009 MiB` (unchanged)

| Metric | Measured Value |
|---|---|
| Cold Boot (`shellReady` + `waylandActive`) | `19.2s` |
| Warm Reboot | `47.4s` |
| Memory (`free -m` under Plasma 6.6.6 + Dolphin) | `1157 MiB` used / `2009 MiB` total (`851 MiB` available, `770 MiB` buff/cache) |
| Root Disk (`/dev/wda` ext4) | `1.5G` used / `2.9G` (`54%`) |
| Home Disk (`/dev/wdb` ext4) | `36M` used / `16G` (`1%`) |
| Installed Packages | `594` (base KDE) -> `595` (after `tree-2.3.2-r0`) |
