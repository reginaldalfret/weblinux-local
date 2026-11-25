# Phase 8 — Phase 7: Profile & Storage Persistence

**Date:** 2026-11-25

---

## 1. Storage Architecture

- **Rootfs (`/dev/wda`):** Isolated per browser-enabled distribution (`root-ubuntu-kde-epiphany`, `root-debian-firefox`).
- **Persistent Home (`/dev/wdb`):** Shared across distribution desktop sessions (`home-ubuntu`, `home-debian`), storing `/root/.local/share/epiphany`, `/root/.config/epiphany`, `/root/Downloads`, and `/root/browser-home`.

---

## 2. Observed Persistence & Clean Shutdown Behavior

Tested in [`tests/test-phase8-epiphany.js`](file:///E:/Web-Linux/weblinux-local/tests/test-phase8-epiphany.js) across shutdown and warm reboot in the same Edge `BrowserContext`:

1. **Profile & Download Creation:**
   - Epiphany created `/root/.local/share/epiphany/` (`bookmarks.gvdb`, `cookies.sqlite`, `ephy-history.db`, `ephy-history.db-shm`, `ephy-history.db-wal`, `itp/`, `mediakeys/`, `storage/`).
   - `curl` downloaded `/root/Downloads/example.html` (`577` bytes, SHA-256 `25ddf2c883e0d1958ea971d279a7e4f0fd446724ee3db7db19dadabd4a62e484`).
2. **Reboot Persistence & Ext4 Flush Finding:**
   - `/root/Downloads/example.html` (`577` bytes) persisted across reboot on `/dev/wdb`.
   - However, because `WasmLinuxAdapter.shutdown()` previously waited only `800ms` after sending `sync\r` to serial `key_input` before calling `activeOs.terminate()`, dirty ext4 directory/metadata blocks from active `plasmashell` + `epiphany` SQLite WAL writes were not fully flushed, causing `EXT4-fs error (device wdb): __ext4_find_entry:1626: checksumming directory block 0` on reboot.
   - Increased the post-`sync` flush window in [`runtime/adapters/WasmLinuxAdapter.ts`](file:///E:/Web-Linux/weblinux-local/runtime/adapters/WasmLinuxAdapter.ts) from `800ms` to `1500ms`. For production/automated workflows, stopping active SQLite-backed browser processes and running `sync` before Power Off ensures clean ext4 metadata persistence.
