# Phase 13.8 — Initramfs Integration

**Date:** 2026-11-27  
**Script:** `scripts/update-initramfs-alpine.sh`  
**Artifact:** `apps/web/public/runtime/initramfs-wasm64_nommu.cpio.gz`

---

## 1. Initramfs Handlers & `/init` Patch

- Added `/bin/alpine-root` (mounts `/alpine/proc`, `/alpine/sys`, `/alpine/dev`, `/alpine/dev/pts`, `/alpine/run`, `/alpine/tmp`, bind-mounts `/usr/lib/{hostnode,wlserver,rvgpu,hostopen}`, and chroots via `env -i`).
- Added `/bin/alpine-kde` (invokes `/bin/alpine-root /usr/local/bin/alpine-kde-session`).
- Patched `/init` for `alpine*)` alongside `debian`, `ubuntu*`, `arch*`, `opensuse*`, and `fedora*` (`/dev/wda` -> `/alpine`, `/dev/wdb` -> `/alpine/root`).
- **Repacked Initramfs Hashes:**
  - `COMPRESSED_SIZE`: `15064075` bytes
  - `COMPRESSED_SHA256`: `e5081a47223a8003e637039e9a3546a1220a1d6f246f665ac5df2e437c60e96c`
  - `UNCOMPRESSED_SIZE`: `36659200` bytes
  - `UNCOMPRESSED_SHA256`: `d1af61263f50c874fbc72d5ae2ee411886db0a31dfba7828e802bc50875a9b81`
