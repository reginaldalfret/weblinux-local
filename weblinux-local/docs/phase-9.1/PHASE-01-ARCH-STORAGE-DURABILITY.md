# Phase 9.1 — Arch Linux KDE Storage Durability Investigation

## 1. Root Cause of Earlier `warmPersistence: false`

In Phase 9 (`tests/test-phase9-arch-kde.js`), warm reboot persistence was tested inside an ephemeral Playwright `browser.newContext()` with a single-line shell echo (`echo ARCH_PERSIST_OK_9 > /root/arch-persist-test.txt`) immediately prior to `plasmashell` shutdown. Meanwhile, `home-arch-kde` (`/dev/wdb` mounted on `/arch/root`) was never tested across a persistent browser profile or normal browser page reload.

## 2. Persistent-Context Durability Qualification (`tests/test-phase91-arch-persistence.js`)

Tested in Microsoft Edge using `chromium.launchPersistentContext` (no site-data clearing, no `resetAll()`, no re-formatting of `home-arch-kde`):

- **Storage Mapping Verified:**
  - Root disk: `root-arch-kde` -> `/dev/wda` mounted on `/arch` (`ext4`, `rw,noatime`, `UUID=2de12b0d-95e2-4370-aabd-29606fdfc918`)
  - Home disk: `home-arch-kde` -> `/dev/wdb` mounted on `/arch/root` (`ext4`, `rw,noatime`, `UUID=cb3bea2a-b092-4de5-ad57-b78aeb0ac313`)
- **Phase A (First Boot):**
  - Wrote `16437` bytes (`P91_ARCH_PERSIST_1795705390680`, timestamp, plus `16 KiB` patterned blocks) to `/root/p91-persist-test.dat` and synced.
  - Expected SHA-256: `4c07826feaec647fe83b1579c78ed8cfc05c33d1d5cce923dee34ebdbb95dfbf`.
- **Phase B (Power Off -> Restart in Same Persistent BrowserContext):**
  - Kernel dmesg: `EXT4-fs (wdb): recovery complete` (zero `EXT4-fs error` entries).
  - Guest `sha256sum /root/p91-persist-test.dat`: `4c07826feaec647fe83b1579c78ed8cfc05c33d1d5cce923dee34ebdbb95dfbf` (byte-for-byte identical).
  - Wrote `RELOAD_MARKER_91` to `/root/p91-reload.txt` and synced.
- **Phase C (Power Off -> `page.reload()` -> Restart in Same Persistent BrowserContext):**
  - Kernel dmesg: `EXT4-fs (wdb): recovery complete` (zero `EXT4-fs error` entries).
  - `cat /arch/root/p91-reload.txt`: `RELOAD_MARKER_91`.
  - `sha256sum /root/p91-persist-test.dat`: `4c07826feaec647fe83b1579c78ed8cfc05c33d1d5cce923dee34ebdbb95dfbf` (byte-for-byte identical).

## 3. Conclusion

OPFS home persistence (`home-arch-kde` on `/dev/wdb`) is **fully functional and byte-for-byte durable** across both normal Power Off and browser page reload when running in a persistent browser profile.
