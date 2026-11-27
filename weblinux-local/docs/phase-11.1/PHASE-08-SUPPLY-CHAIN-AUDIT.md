# Phase 11.1.7 — Build and Supply-Chain Security Audit

**Date:** 2026-11-27  
**Audited Scripts:**
- `scripts/fetch-fedora-riscv-rootfs.sh`
- `scripts/build-fedora-kde-rootfs.sh`
- `scripts/update-initramfs-fedora.sh`
- `scripts/package-fedora-kde-image.sh`

---

## 1. Control Verification Matrix

| Control | Status | Details |
|---|---|---|
| 1. Downloads use HTTPS | **PASS** | `fetch-fedora-riscv-rootfs.sh` enforces `--proto '=https' --tlsv1.2` on `dl.fedoraproject.org`. |
| 2. Checksums verified before extraction | **PASS** | `sha256sum -c "${NAME}.sha256"` runs with `set -euo pipefail` before any `tar` extraction. |
| 3. Detached signatures verified when published | **PASS WITH LIMITATION** | `dl.fedoraproject.org/pub/alt/risc-v/releases/45/` does not publish detached `.asc` PGP signatures for RISC-V tarballs; integrity relies on HTTPS + SHA-256. |
| 4. Trusted key fingerprints checked | **PASS** | `build-fedora-kde-rootfs.sh` verifies full 160-bit fingerprint `4F50A6114CD5C6976A7F1179655A4B02F577861E` of `RPM-GPG-KEY-fedora-45-primary` before `rpmkeys --import`. |
| 5. Safe archive extraction | **PASS** | `fetch-fedora-riscv-rootfs.sh` uses `tar --no-same-owner` and `--no-overwrite-dir` into an isolated staging directory (`$OCI_DIR`, `$ROOTFS`). |
| 6. Failed downloads do not leave partial artifacts | **PASS** | `set -euo pipefail` and `curl -fSL` abort before extraction on HTTP or checksum errors. |
| 7. Fail-safe on package verification | **PASS** | `/etc/dnf/repos.override.d/99-weblinux-security.repo` enforces `gpgcheck=1`, `sslverify=1`, `skip_if_unavailable=0`, and disables `fedora-staging`/`fedora-koji`. Zero `--nogpgcheck`/`--nosignature` flags in any script. |
| 8. Reproducible package locks | **PASS** | `docs/phase-11/fedora-kde-packages.lock` records all `717` installed NEVRAs. |
| 9. Temporary staging data handled safely | **PASS** | `qemu-riscv64-static` is removed via `trap cleanup EXIT` in `build-fedora-kde-rootfs.sh`; `/tmp/initrd-fedora` cleaned in `update-initramfs-fedora.sh`. |
| 10. Chunk naming & manifest integrity | **PASS** | `package-fedora-kde-image.sh` runs `e2fsck -fy`, writes 6-digit decimal chunks (`000000`–`003327`) to `D:\weblinux-disks\fedora-kde\`, and verifies full round-trip SHA-256 (`RECONSTRUCT_OK=True`). |
