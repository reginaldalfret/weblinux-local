# Phase 11 — Persistence & Cross-Distribution Isolation

## 1. Persistent-Context OPFS Verification

Tested in Microsoft Edge using `chromium.launchPersistentContext` (no `resetAll()`, no site-data clearing, no re-formatting of `home-fedora-kde`):

1. **Warm Reboot Persistence (`tests/test-phase11-fedora-kde.js`, `task-9022` & `task-9040`):**
   - Wrote `16437` bytes (`P11_FEDORA_PERSIST_1795718051948`, `SHA-256: 967aa397818ddde5b74bd8b22b5e502bad53e0f5ff7619f3acf323329e51432b`) to `/root/p11-fedora-persist.dat`.
   - Clean Power Off -> Reboot (`39.2s`): `EXT4-fs (wdb): recovery complete`, zero `EXT4-fs error`, `sha256sum` matched `967aa397818ddde5b74bd8b22b5e502bad53e0f5ff7619f3acf323329e51432b` byte-for-byte.
2. **Browser Page Reload Persistence (`task-9059`):**
   - Wrote `16403` bytes (`FEDORA_RELOAD_OK_11`, `SHA-256: 1702a66857125dc2c82d203c411a7c014334e3e83b7a869c03028044cf02da3b`) to `/root/p11-rel.dat`.
   - Clean Power Off -> `page.reload()` -> Reboot: `EXT4-fs (wdb)` mounted cleanly (zero `EXT4-fs error`), `sha256sum` matched `1702a66857125dc2c82d203c411a7c014334e3e83b7a869c03028044cf02da3b` byte-for-byte.

## 2. Cross-Distribution Disk Isolation

| Distribution | Root Disk (`/dev/wda`) | Home Disk (`/dev/wdb`) | Mount Point |
|---|---|---|---|
| Debian 13 KDE | `root-debian-kde-plasma` | `home-debian` | `/debian` |
| Ubuntu 24.04 KDE | `root-ubuntu-kde` | `home-ubuntu` | `/ubuntu` |
| Arch Linux KDE 6 | `root-arch-kde` | `home-arch-kde` | `/arch` |
| openSUSE Tumbleweed KDE | `root-opensuse-tumbleweed-kde` | `home-opensuse-tumbleweed-kde` | `/opensuse` |
| Fedora 45 KDE | `root-fedora-kde` | `home-fedora-kde` | `/fedora` |
