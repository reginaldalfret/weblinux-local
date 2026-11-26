# Phase 8.1 — Phase 6: Firefox ESR NOMMU Compatibility Investigation

**Date:** 2026-11-26  
**Target:** Debian 13 (Trixie) `riscv64` — `firefox-esr` `153.5.1esr-1~deb13u1`

---

## 1. ELF & Contiguous Memory Allocation Findings

1. **Shared Object Size:**
   - `/usr/lib/firefox-esr/libxul.so` is **`153 MiB`** (`-rw-r--r-- 1 root root 153M`).
2. **NOMMU `mmap` Requirement:**
   - Under Linux `6.6.0-wasm64_nommu` (no hardware MMU / virtual page remapping), `dlopen("/usr/lib/firefox-esr/libxul.so")` must map `libxul.so`'s `PT_LOAD` segments into a **single contiguous physical memory region** (`order 16` = `256 MiB` buddy block, since `153 MiB > 128 MiB` `order 15`).
3. **Observed Buddy Allocator State (`/proc/buddyinfo`):**
   - `CONFIG_COMPACTION` is not enabled (`/proc/sys/vm/compact_memory: No such file or directory`).
   - With KDE Plasma 6 running on `mem=2048M` (`1310–1377 MiB` used, `583–703 MiB` free):
     `Node 0, zone Normal ... 8 0 2 1 1 0 0 0 0` -> **`0` blocks of `order 15` (128 MiB) and `0` blocks of `order 16` (256 MiB)**.
   - Even after `killall -9 plasmashell` (`1429 MiB` free, `584 MiB` used), `/proc/buddyinfo` had `1` block of `order 15` (`128 MiB`) and **`0` blocks of `order 16` (`256 MiB`)**.
   - Result: `XPCOMGlueLoad error for file /usr/lib/firefox-esr/libxul.so: failed to map segment from shared object / Couldn't load XPCOM.`

---

## 2. `/bin/rv` NOMMU `fork()` Findings

- When `firefox-esr` did map `libxul.so` early in boot (before Plasma fragmented memory), child-process creation via `fork()` failed with:
  `rv: cannot copy the guest from the parent of a fork`
- Under `/bin/rv`, `fork()` attempts to duplicate the parent guest's address space; duplicating a >150 MiB Gecko process exceeds `/bin/rv` NOMMU copy/heap limits.
- Furthermore, `/usr/local/bin/firefox-esr-weblinux`'s `su -s /bin/bash browser` failed with `su: Authentication failure` under NOMMU PAM without `/etc/shadow`.

---

## 3. Conclusion

- Supporting `firefox-esr` `153.5.1esr` in `2048 MiB` NOMMU would require either:
  1. Enabling `CONFIG_COMPACTION` + raising guest RAM beyond the `2048 MiB` limit, **and**
  2. Re-engineering `/bin/rv`'s `fork()` / ELF `mmap()` architecture, or compiling a custom split-DSO/single-process Gecko build.
- Per Phase 8.1 safety rules, we do **not** weaken memory safety or raise the `2048 MiB` guest RAM limit.
- **Status:** `DEBIAN FIREFOX ESR BLOCKED BY NOMMU`
