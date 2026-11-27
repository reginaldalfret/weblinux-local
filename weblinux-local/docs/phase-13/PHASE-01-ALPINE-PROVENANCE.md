# Phase 13.1 — Official Alpine Linux 3.24.4 RISC-V Provenance

**Date:** 2026-11-27  
**Acquisition Script:** `scripts/fetch-alpine-riscv-rootfs.sh`

---

## 1. Verified Release Artifact

- **Source URL:** `https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/riscv64/alpine-minirootfs-3.24.4-riscv64.tar.gz`
- **Detached Signature URL:** `https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/riscv64/alpine-minirootfs-3.24.4-riscv64.tar.gz.asc`
- **Checksum URL:** `https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/riscv64/alpine-minirootfs-3.24.4-riscv64.tar.gz.sha256`
- **Release Signing Key URL:** `https://alpinelinux.org/keys/ncopa.asc` (published on `https://alpinelinux.org/downloads/`)
- **Downloaded Size:** `3.3 MiB` (`3,453,167` bytes)
- **SHA-256:** `010683db6c73b3ad1c334fc8f93f64ae748ef67ae6d69e964929aeaf8517bff3`

---

## 2. Cryptographic Verification Outputs

1. **Key Fingerprint Check:**
   `KEY_FINGERPRINT=0482D84022F52DF1C4E7CD43293ACD0907D9495A` (exact match to `0482 D840 22F5 2DF1 C4E7 CD43 293A CD09 07D9 495A`).
2. **Detached OpenPGP Signature (`gpg --verify`):**
   ```
   gpg: Signature made Thu 05 Nov 2026 05:13:26 PM IST
   gpg:                using RSA key 0482D84022F52DF1C4E7CD43293ACD0907D9495A
   gpg: Good signature from "Natanael Copa <ncopa@alpinelinux.org>" [unknown]
   Primary key fingerprint: 0482 D840 22F5 2DF1 C4E7  CD43 293A CD09 07D9 495A
   ```
3. **SHA-256 Check (`sha256sum -c`):**
   `alpine-minirootfs-3.24.4-riscv64.tar.gz: OK`
4. **Extracted Identity:**
   - `/etc/alpine-release`: `3.24.4`
   - `/etc/os-release`: `NAME="Alpine Linux"`, `ID=alpine`, `VERSION_ID=3.24.4`, `PRETTY_NAME="Alpine Linux v3.24"`
