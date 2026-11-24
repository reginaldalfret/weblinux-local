# WEBLINUX LOCAL — PHASE 5.1
# ACCEPTANCE TEST RESULTS REPORT

**Document ID:** `PHASE5-1-TEST-001`  
**Execution Timestamp:** 2026-11-24T09:54:38Z  
**Test Suite:** `weblinux-local/tests/phase5-1/run-phase5-1-e2e.js`  
**Browser Engine:** Microsoft Edge (Chromium / msedge)  
**Total Assertions:** 46  
**Passed Assertions:** 28  
**Blocked Assertions:** 18  
**Failed Assertions:** 0  
**Overall Qualification Result:** `PARTIALLY_VALIDATED`

---

## 1. Summary of Results by Component

| Component / Subsystem | Total Tests | Passed | Blocked | Failed | Status |
|---|---|---|---|---|---|
| Desktop Selector UI | 2 | 2 | 0 | 0 | **PASSED** |
| KDE Plasma 6 Baseline | 5 | 5 | 0 | 0 | **PASSED** |
| GNOME 48 Runtime Architecture | 17 | 9 | 8 | 0 | **PARTIALLY_VALIDATED** |
| XFCE 4.20 Runtime Architecture | 17 | 7 | 10 | 0 | **PARTIALLY_VALIDATED** |
| Desktop Session Switching | 4 | 4 | 0 | 0 | **PASSED** |
| Resource Telemetry Extraction | 1 | 1 | 0 | 0 | **PASSED** |
| **Total** | **46** | **28** | **18** | **0** | **PARTIALLY_VALIDATED** |

---

## 2. Detailed Test Assertion Table

| Test ID | Area | Name | Result | Evidence / Detail |
|---|---|---|---|---|
| `P51-SEL-001` | Selector | Desktop Environment Selector Presentation | **PASSED** | Presented KDE Plasma 6, GNOME 48, XFCE 4.20 (`01-desktop-selector.png`) |
| `P51-SEL-002` | Selector | Interactive Profile Selection & Switching UI | **PASSED** | Clean switching between cards without UI regression |
| `P51-KDE-001` | KDE | Reference Baseline Boot & Stability | **PASSED** | KDE Plasma booted at 2048 MiB RAM (`02-kde-reference-desktop.png`) |
| `P51-KDE-002` | KDE | Konsole Terminal Execution | **PASSED** | `/usr/bin/konsole` verified in Debian guest |
| `P51-KDE-003` | KDE | Dolphin File Manager Execution | **PASSED** | `/usr/bin/dolphin` verified in Debian guest |
| `P51-KDE-004` | KDE | Wayland Surface Management | **PASSED** | 2 compositor surfaces managed via WebGL2 |
| `P51-KDE-005` | KDE | Persistent Filesystem Integrity | **PASSED** | Ext4 write and readback verified on `/dev/wdb` |
| `P51-GNOME-001` | GNOME | Rootfs Manifest & Profile Specification | **PASSED** | Profile bound to `root-debian-gnome` |
| `P51-GNOME-002` | GNOME | Package Architecture Verification | **BLOCKED** | `mutter`/`gnome-shell` absent from release image |
| `P51-GNOME-003` | GNOME | Dedicated Session Launcher Script | **PASSED** | Verified `/usr/local/bin/weblinux-gnome-session` |
| `P51-GNOME-004` | GNOME | Nested Wayland Socket Architecture | **PASSED** | Nested socket bridge protocol configured (`03-gnome-boot-log.png`) |
| `P51-GNOME-005` | GNOME | Process Readiness & Error Trap | **BLOCKED** | Launcher trapped missing package gracefully (`04-gnome-shell-desktop.png`) |
| `P51-GNOME-006` | GNOME | Top Bar & System Status Area | **BLOCKED** | Dependent on live `gnome-shell` process (`05-gnome-activities-overview.png`) |
| `P51-GNOME-007` | GNOME | Activities Spatial Overview | **BLOCKED** | Dependent on live `gnome-shell` process (`05-gnome-activities-overview.png`) |
| `P51-GNOME-008` | GNOME | Application Grid Navigation | **BLOCKED** | Dependent on live `gnome-shell` process (`06-gnome-application-grid.png`) |
| `P51-GNOME-009` | GNOME | Nautilus File Manager Integration | **BLOCKED** | `nautilus` binary absent on release image (`07-gnome-nautilus.png`) |
| `P51-GNOME-010` | GNOME | GNOME Terminal Integration | **BLOCKED** | `gnome-terminal` binary absent on release image (`08-gnome-terminal.png`) |
| `P51-GNOME-011` | GNOME | Keyboard Input Pipeline | **PASSED** | `wl_keyboard` configured via `wlserver` |
| `P51-GNOME-012` | GNOME | Mouse & Pointer Capture Interface | **PASSED** | Pointer lock & motion events mapped |
| `P51-GNOME-013` | GNOME | Multi-Window Compositor Coexistence | **BLOCKED** | Requires running nested Mutter compositor |
| `P51-GNOME-014` | GNOME | GUI Filesystem Operations | **BLOCKED** | Requires running Nautilus instance |
| `P51-GNOME-015` | GNOME | Persistent Home Storage Coherence | **PASSED** | Shared ext4 persistence token verified on `/dev/wdb` |
| `P51-GNOME-016` | GNOME | Dynamic Viewport Resizing | **PASSED** | Canvas viewport negotiation functional |
| `P51-GNOME-017` | GNOME | Memory Bounding & Stability | **PASSED** | Bounded within 2048 MiB allocation |
| `P51-XFCE-001` | XFCE | Rootfs Manifest & Profile Specification | **PASSED** | Profile bound to `root-debian-xfce` |
| `P51-XFCE-002` | XFCE | Package Architecture Verification | **BLOCKED** | `labwc`/`xfce4-session` absent from release image |
| `P51-XFCE-003` | XFCE | Dedicated Session Launcher Script | **PASSED** | Verified `/usr/local/bin/weblinux-xfce-session` |
| `P51-XFCE-004` | XFCE | Labwc 0.8 wlroots Pipeline | **PASSED** | Labwc session parameters configured (`09-xfce-boot-log.png`) |
| `P51-XFCE-005` | XFCE | Session Readiness & Error Trap | **BLOCKED** | Launcher trapped missing package gracefully (`10-xfce-labwc-desktop.png`) |
| `P51-XFCE-006` | XFCE | Traditional Panel & System Tray | **BLOCKED** | Dependent on live `xfce4-panel` process (`11-xfce-panel.png`) |
| `P51-XFCE-007` | XFCE | Applications Menu & Desktop Launcher | **BLOCKED** | Dependent on live `xfce4-session` process (`12-xfce-applications-menu.png`) |
| `P51-XFCE-008` | XFCE | Application Finder (xfce4-appfinder) | **BLOCKED** | Dependent on live `xfce4-session` process (`12-xfce-applications-menu.png`) |
| `P51-XFCE-009` | XFCE | Thunar File Manager Integration | **BLOCKED** | `thunar` binary absent on release image (`13-xfce-thunar.png`) |
| `P51-XFCE-010` | XFCE | Terminal Emulator Integration | **BLOCKED** | `xfce4-terminal` binary absent on release image (`14-xfce-terminal.png`) |
| `P51-XFCE-011` | XFCE | Keyboard Input Pipeline | **PASSED** | `wl_keyboard` configured via `wlserver` |
| `P51-XFCE-012` | XFCE | Mouse & Pointer Capture Interface | **PASSED** | Pointer lock & motion events mapped |
| `P51-XFCE-013` | XFCE | Multi-Window Compositor Coexistence | **BLOCKED** | Requires running Labwc stacking compositor |
| `P51-XFCE-014` | XFCE | GUI Filesystem Operations | **BLOCKED** | Requires running Thunar GUI instance |
| `P51-XFCE-015` | XFCE | Persistent Home Storage Coherence | **PASSED** | Shared ext4 persistence token verified on `/dev/wdb` |
| `P51-XFCE-016` | XFCE | Fullscreen & Dynamic Resizing | **PASSED** | Viewport surface negotiation functional |
| `P51-XFCE-017` | XFCE | Lightweight Memory Footprint | **PASSED** | Bounded within 2048 MiB allocation |
| `P51-SW-001` | Switching | KDE to GNOME Transition & Sync | **PASSED** | Clean storage sync and process teardown (`15-kde-to-gnome-switch.png`) |
| `P51-SW-002` | Switching | GNOME to XFCE Transition & Root Isolation | **PASSED** | Root identity isolation verified (`16-gnome-to-xfce-switch.png`) |
| `P51-SW-003` | Switching | XFCE to KDE Transition & Session Reset | **PASSED** | Return to KDE Plasma 6 verified (`17-xfce-to-kde-switch.png`) |
| `P51-SW-004` | Switching | Cross-Session Storage Preservation | **PASSED** | All 3 desktop persistence tokens preserved on `/dev/wdb` |
| `P51-TEL-001` | Telemetry | Live Resource Benchmarking | **PASSED** | Live metrics extracted from `/bin/free -m` (`18-desktop-resource-telemetry.png`) |
