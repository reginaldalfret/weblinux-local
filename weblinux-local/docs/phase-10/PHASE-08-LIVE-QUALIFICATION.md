# Phase 10 — Live Microsoft Edge Qualification

## 1. Test Execution (`tests/test-phase10-opensuse-kde.js`, `task-8876`)

- **Browser:** Microsoft Edge (`chromium.launchPersistentContext`)
- **Cold Boot (`shellReady: true`, `waylandActive: true`):** `21.7s`
- **Mounts:** `/dev/wda on /opensuse` (`ext4`), `/dev/wdb on /opensuse/root` (`ext4`)
- **Memory Usage:** `904 MiB` used / `2009 MiB` total (`1104 MiB` available)
- **Screenshots Captured:**
  - `p10-01-opensuse-selector.png` — Distribution selector card
  - `p10-02-opensuse-kde-desktop.png` — Plasma 6.8.2 desktop
  - `p10-03-opensuse-launcher.png` — openSUSE Kickoff launcher (Firefox, Dolphin, System Settings, Konsole)
  - `p10-04-opensuse-konsole.png` — Konsole 26.08.3 showing `Linux rv 6.6.0 #1 SMP rv riscv64 GNU/Linux` & `/etc/os-release`
  - `p10-05-opensuse-dolphin.png` — Dolphin 26.08.3 over Konsole
  - `p10-06-opensuse-window-ops.png` — Window focus/drag verification
- **Persistent-Context Reboot & Integrity:**
  - Wrote `16437` bytes (`P10_OPENSUSE_PERSIST_1795713988922`, `SHA-256: 97f43755689887324e8d41315c73277e0cb838abd620b6e92f0b4c57161636ad`) to `/root/p10-opensuse-persist.dat`.
  - Clean Power Off -> Warm reboot in `55.9s` (`EXT4-fs (wdb): recovery complete`, zero `EXT4-fs error`).
  - `sha256sum /root/p10-opensuse-persist.dat` matched `97f43755689887324e8d41315c73277e0cb838abd620b6e92f0b4c57161636ad` byte-for-byte.
