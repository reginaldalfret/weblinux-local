# Phase 14.0 — Existing Browser & Runtime Audit

**Date:** 2026-11-27  
**Branch:** `feature/runtime-foundations`  
**Verified Starting HEAD:** `f3b49a8104c31f3182852aff1175a32499dec480`

---

## 1. Phase 8 / 8.1 Findings

1. **Debian 13 Firefox ESR (`153.5.1esr-1~deb13u1`, `riscv64`):**
   - `libxul.so` (`153 MiB`) requires a single `order 16` (`256 MiB`) contiguous physical block under Linux NOMMU without `CONFIG_COMPACTION`; `/proc/buddyinfo` had `0` `order 16` blocks under `2048 MiB` RAM.
   - Child process `fork()` failed under `/bin/rv` (`rv: cannot copy the guest from the parent of a fork`).
   - Status: `DEBIAN FIREFOX ESR BLOCKED BY NOMMU`.
2. **Ubuntu 24.04.5 Epiphany Web (`46.0-2build1`, `riscv64`):**
   - Rendered external HTTPS pages via WebKitGTK 6.0 + `posix_spawn()`, **but** required `JSC_useJIT=0` and `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` to bypass `bwrap` user-namespace sandboxing inside the NOMMU chroot.
3. **Guest Network Relay (`scripts/guest-net-relay.js`):**
   - Listens on `ws://127.0.0.1:8081`, blocks RFC1918/loopback/link-local/multicast destinations, and forwards raw TCP/TLS end-to-end.
4. **Host Build Resources:**
   - `D:` free space: `34.41 GiB` (`C:` `9.79 GiB`, `E:` `64.73 GiB`).
   - WSL2 `Fedora-45`: `3.5 GiB` RAM, `8.0 GiB` swap, `6` logical cores.
