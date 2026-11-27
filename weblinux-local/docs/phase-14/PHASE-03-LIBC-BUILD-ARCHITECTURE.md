# Phase 14.3 — Libc ABI Build Architecture (glibc vs. musl)

**Date:** 2026-11-27

---

## 1. Planned Two-Family ABI Split

- **glibc family (5 distributions):** Debian 13, Ubuntu 24.04.5, Arch Linux, openSUSE Tumbleweed, Fedora 45.
  - Would require targeting the lowest common glibc baseline (Ubuntu 24.04 / Debian 13 `riscv64` `LP64D`, `/lib/ld-linux-riscv64-lp64d.so.1`) or per-distro builds from pinned `158.0.8127.88` due to ICU/GTK/NSS soname differences across rolling (Arch/openSUSE) vs. stable (Debian/Ubuntu) vs. Fedora 45.
- **musl family (1 distribution):** Alpine Linux 3.24.4 (`musl-1.2.6-r3`, `/lib/ld-musl-riscv64.so.1`).
  - Requires separate musl-native build + musl stack/allocator/sandbox patches (no glibc binaries or `gcompat`).
- **Status:** **BLOCKED** by Phase 14.2 build-resource preflight (`34.41 GiB` free on `D:`, `3.5 GiB` RAM) and Phase 14.6 NOMMU kernel sandbox blocker.
