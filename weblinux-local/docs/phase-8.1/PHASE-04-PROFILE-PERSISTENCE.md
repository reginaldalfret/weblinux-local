# Phase 8.1 — Phase 4: Profile & Download Persistence

**Date:** 2026-11-26

---

## 1. Observed Persistence State on `/dev/wdb` (`home-ubuntu`)

Tested in [`tests/test-phase8-epiphany.js`](file:///E:/Web-Linux/weblinux-local/tests/test-phase8-epiphany.js) across guest shutdown and warm reboot in the same Edge `BrowserContext`:

1. **Profile Databases Created:**
   - `/root/.local/share/epiphany/` contained `bookmarks.gvdb` (`157` bytes), `cookies.sqlite` (`8192` bytes), `ephy-history.db` (`4096` bytes + `-shm` / `-wal`), `itp/`, `mediakeys/`, and `storage/`.
2. **Download Verification:**
   - `curl -sL -o /root/Downloads/example.html https://example.com` produced `/root/Downloads/example.html` (`577` bytes, SHA-256 `25ddf2c883e0d1958ea971d279a7e4f0fd446724ee3db7db19dadabd4a62e484`).
3. **Reboot Persistence & Flush Behavior:**
   - `/root/Downloads/example.html` (`577` bytes) survived reboot on `/dev/wdb`.
   - When `shutdown()` was called while `epiphany` SQLite WAL and `plasmashell` were actively writing without an explicit `pkill` + `sync`, ext4 reported directory block checksum errors on `/dev/wdb` (`__ext4_find_entry:1626: checksumming directory block 0`).
   - `WasmLinuxAdapter.ts` `shutdown()` flush wait was increased from `800ms` to `1500ms`.
