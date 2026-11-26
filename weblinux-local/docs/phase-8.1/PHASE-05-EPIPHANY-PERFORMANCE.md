# Phase 8.1 — Phase 5: Browser Performance & Resource Measurements

**Date:** 2026-11-26

---

## 1. Measured Timings & Memory (`mem=2048M`, `maxcpus=3`)

| Metric | Observed Value | Source |
|---|---|---|
| **Ubuntu KDE + Epiphany Cold Boot (`shellReady`)** | `22.1s – 30.4s` | `test-phase8-epiphany.js`, `diag-phase81-epiphany.js` |
| **Ubuntu KDE Plasma 5.27 Cold Panel Settle** | `~105s – 119s` | `test-phase7-kde-rvgpu.js`, `diag-phase81-epiphany.js` |
| **Ubuntu KDE Warm Reboot (`runtimeReady`)** | `27s` | `test-phase652-acceptance.js` |
| **Epiphany First-Run Migrator (`38` steps)** | `~21s` | `task-7992` |
| **Epiphany `org.freedesktop.secrets` D-Bus Delay** | `~30s` | `task-7992` |
| **`MiniBrowser` First-Page Paint (`https://example.com`)** | `<= 95s` (post-Plasma settle) | `task-8042` (`p81-01-minibrowser-95s.png`) |
| **Guest RAM (`MiniBrowser` + `example.com`)** | `959 MiB` used / `2009 MiB` (`1049 MiB` avail) | `task-8042` |
| **Guest RAM (`epiphany` + `example.com`)** | `979–1101 MiB` used / `2009 MiB` (`907–1029 MiB` avail) | `task-7838`, `task-7899` |
| **Guest RAM (2x `MiniBrowser` + `gnu.org`)** | `1379 MiB` used / `2009 MiB` (`396 MiB` free) | `task-8087` |
