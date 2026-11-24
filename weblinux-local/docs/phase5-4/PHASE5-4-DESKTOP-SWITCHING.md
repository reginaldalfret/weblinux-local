# WEBLINUX LOCAL — PHASE 5.4
# DESKTOP SESSION SWITCHING PROTOCOL & COHERENCE

**Document ID:** `PHASE5-4-SW-001`  
**Adapter:** `WasmLinuxAdapter.ts`  
**Storage Architecture:** Dual block device (`/dev/wda` rootfs, `/dev/wdb` persistent home)  
**Status:** FULLY VERIFIED (`PASSED`)  

---

## 1. Verified Switching Protocol

Desktop transitions adhere to the 4-stage synchronization protocol:

1. **Storage Flush:**
   - Issues asynchronous `sync` inside guest to flush all pending ext4 journal transactions and inode updates to `/dev/wdb`.
2. **Process Teardown:**
   - Issues `pkill -TERM -f "plasmashell|kwin|mutter|gnome-shell|labwc|xfce4"` to terminate active compositor surfaces.
3. **Wayland Socket Purge:**
   - Removes stale sockets in `/tmp/runtime-root/wayland-*` and `/run/wlserver/wayland-*`.
4. **Guest Profile Transition:**
   - Sets state to `stopped` and binds storage partitions to the target desktop profile without data loss on `/dev/wdb`.

---

## 2. Transition Testing Results

- **`KDE Plasma 6 -> GNOME 48`:** Clean storage flush, processes halted, profile identity remapped to `root-debian-gnome` (**PASSED**).
- **`GNOME 48 -> XFCE 4.20`:** Clean storage flush, profile identity remapped to `root-debian-xfce` (**PASSED**).
- **`XFCE 4.20 -> KDE Plasma 6`:** Return to reference baseline; storage coherence intact (**PASSED**).
- **Persistent Storage Coherence:** All files written during testing (`/root/WebLinux-Phase5-Tests/`) verified 100% intact (**PASSED**).
