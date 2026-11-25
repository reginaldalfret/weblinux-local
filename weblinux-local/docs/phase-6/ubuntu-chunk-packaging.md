# WEBLINUX LOCAL — PHASE 6.2.7
# UBUNTU 24.04.5 LTS CHUNK PACKAGING REPORT

**Document ID:** `PHASE6-2-CHUNK-PKG-001`  
**Workspace:** `E:\Web-Linux\weblinux-local`  
**Branch:** `feature/ubuntu-24.04-noble`  
**Target:** Ubuntu 24.04.5 LTS (Noble Numbat) riscv64  
**Date:** 2026-11-24  
**Status:** COMPLETE & PACKAGED  

---

## 1. Packaging Summary

The 2 GiB ext4 root filesystem image (`.phase6-build/filesystem/ubuntu-24.04.ext4`) was sliced into deterministic 1 MiB chunks compliant with WebLinux Local's block-loading contract.

### 1.1 Packaging Metrics:
- **Source Disk Image:** `ubuntu-24.04.ext4`
- **Total Image Size:** `2,147,483,648 bytes` (2 GiB)
- **Chunk Size (`piece`):** `1,048,576 bytes` (1 MiB)
- **Total Chunk Count:** `2,048 chunks`
- **Non-Zero Chunk Count:** `85 chunks` (containing filesystem structures and rootfs payload)
- **Zero-Filled Chunk Count:** `1,963 chunks` (free disk space)
- **Output Directory:** `apps/web/public/disk/ubuntu-24.04/`
- **Chunk Naming Scheme:** 6-digit zero-padded decimal string (`000000` through `002047`)

---

## 2. Boot Chunk Map

The boot chunk map lists blocks accessed during cold rootfs initialization:
```json
[
  0, 1, 33, 34, 35, 36, 37, 38, 39,
  40, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 50, 51, 52, 53, 54, 55, 56, 57,
  58, 59, 60, 61, 62, 63
]
```
These 33 chunks contain:
- Superblock and group descriptor tables (Chunk `000000`).
- Journal initialization blocks.
- Root directory inode tables (`/`).
- Initial dynamic linker, glibc, and `/bin/sh` / `/bin/bash` ELF segments.

---

## 3. Metadata Files Created

1. `apps/web/public/disk/ubuntu-24.04/manifest.json`:
   - `size`: `2147483648`
   - `piece`: `1048576`
   - `id`: `5857dce5f4bcee138863b2cb5932c6a37ef15ec971ddf4cfc66167668a820a09`
   - `hashes`: Array of 2048 SHA-256 strings.
   - `boot`: Array of 33 boot chunk indices.
2. `apps/web/public/disk/ubuntu-24.04/integrity.json`:
   - Full build telemetry, source archive provenance, filesystem UUID, and point-in-time timestamp.
