# WebLinux Local — Phase 5: Known Issues & Technical Constraints

**Date:** 2026-11-23  
**Scope:** Multi-Desktop Integration (KDE Plasma 6, GNOME 48, XFCE 4.20) on Debian 13 RISC-V 64-bit NOMMU

---

## 1. High-Impact Issues & Status

| ID | Component | Severity | Description | Mitigation / Workaround | Status |
|---|---|---|---|---|---|
| **P5-ISS-01** | GNOME Shell | Medium | Mutter requires nested Wayland backend (`--wayland --nested`) when running on top of WebLinux `wlserver`. Direct KMS mode is unavailable in browser context. | Profile passes nested startup flag `desktop wayland gnome` mapping Mutter to `wayland-0` and exporting `wayland-1` for child clients. | Documented & Isolated |
| **P5-ISS-02** | XFCE 4.20 | Low | XFCE traditionally defaults to X11/Xfwm4; full Wayland capability requires Labwc 0.8 as the stacking compositor. | Labwc is configured as the display manager/session runner (`labwc -s xfce4-session`), handling layer-shell protocols for panels and desktop icons. | Configured & Documented |
| **P5-ISS-03** | Browser Memory | Medium | Heavy multi-tab browser sessions (15+ tabs with WhatsApp, LinkedIn, ChatGPT) can induce memory pressure leading to `STATUS_ACCESS_VIOLATION` in Chromium. | Guest RAM is strictly clamped to 2048 MiB and WebAssembly worker threads to 4. Users are advised to close inactive browser tabs for optimal stability. | Hardened & Managed |
| **P5-ISS-04** | KDE Splash Screen | Low | `ksplashqml` splash animation displays "Applying settings..." for ~45–60 seconds on initial cold boot before `plasmashell` panels become active. | This is expected during RISC-V WebAssembly JIT initialization of Qt6 libraries. Do not refresh the page during this phase. | Documented Behavior |
| **P5-ISS-05** | Shared Home Coherence | Low | KDE, GNOME, and XFCE write differing dotfiles (`.config/kdeglobals`, `.config/dconf`, `.config/xfce4`) to the same `/root` persistent ext4 disk. | Each desktop uses namespaced configuration directories under `/root/.config/`. No file collisions observed in test runs. | Validated Coherent |

---

## 2. Platform & Browser Limitations

1. **Host Isolation:** Cross-Origin Isolation (`COOP: same-origin`, `COEP: require-corp`) is mandatory. If dev server or proxy fails to send these headers, `SharedArrayBuffer` is disabled and multi-core emulation will refuse to boot.
2. **WebGL2 Canvas:** Hardware acceleration must remain enabled in browser settings. Software WebGL fallback causes significant frame drops.
3. **Storage Persistence:** Virtual ext4 disk `/dev/wdb` relies on the browser's Origin Private File System (OPFS). Clearing browser site data will reset persistent storage.
