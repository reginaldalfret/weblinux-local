# Phase 11.1.4 — Negative Signature Testing

**Date:** 2026-11-27  
**Suite:** `tests/test-phase11-1-fedora-signatures.js`  
**Evidence Logs:** `tests/screenshots/phase11-1/signature-tests.log`, `tests/screenshots/phase11-1/signature-tests-results.json`  
**Result:** **8/8 PASS, 0 FAIL**

All destructive and negative tests executed inside an isolated disposable rootfs (`/tmp/fedora-sig-test-root`), leaving the production rootfs and persistent OPFS disks untouched.

| Test ID | Input | Command Executed | Expected Result | Actual Result | Exit Code | Status |
|---|---|---|---|---|---|---|
| **Test A** | `fedora-gpg-keys-45-1.noarch.rpm` (signed by `655A4B02F577861E`) | `rpmkeys --checksig && dnf5 --setopt=localpkg_gpgcheck=1 install` | Exit 0, `digests signatures OK` | `digests signatures OK`, installed cleanly | `0` | **PASS** |
| **Test B** | `weblinux-sigtest-1.0-1.noarch.rpm` (unsigned) | `dnf5 --setopt=localpkg_gpgcheck=1 install unsigned.rpm` | Non-zero exit with OpenPGP unsigned rejection | `Signature verification failed. OpenPGP check ... has failed: The package is not signed.` | `1` | **PASS** |
| **Test C** | `weblinux-sigtest-wrongkey.rpm` (ephemeral untrusted RSA-2048 key) | `dnf5 --setopt=localpkg_gpgcheck=1 install wrongkey.rpm` | Non-zero exit with untrusted key / OpenPGP rejection | `Signature verification failed. OpenPGP check ... has failed: The repository does not have any OpenPGP keys configured.` | `1` | **PASS** |
| **Test D** | `fedora-gpg-keys-corrupt.rpm` (bit-flipped copy of valid RPM) | `rpmkeys --checksig && dnf5 --setopt=localpkg_gpgcheck=1 reinstall corrupt.rpm` | Non-zero exit with digest/signature tamper failure | `DIGESTS SIGNATURES NOT OK`; `Transaction failed: Signature verification failed.` | `1` | **PASS** |
| **Test E** | `f45/latest/riscv64/repodata/repomd.xml.asc` | `curl repomd.xml.asc && dnf5 repo info fedora` | Documented limitation: `repomd.xml.asc` absent (`404`), `Verify repodata: false`, TLS active | `HTTP 404` for `repomd.xml.asc`; `Verify repodata: false` | `0` | **PASS** |
| **Test F** | `fedora-staging` & `fedora-koji` | `dnf5 repo list --all && dnf5 repoquery shim-unsigned-riscv64` | Staging & koji disabled; staging-only packages excluded | `fedora-staging=disabled`, `fedora-koji=disabled`, `shim-unsigned-riscv64` not resolvable | `0` | **PASS** |
| **Test G** | `/etc/dnf/repos.override.d/99-weblinux-security.repo` | `dnf5 repo info fedora` | `Verify packages=true`, `Skip if unavailable=false`, `RPM-GPG-KEY-fedora-45-primary` | `Verify packages: true; Skip if unavailable: false; Keys: RPM-GPG-KEY-fedora-45-primary` | `0` | **PASS** |
| **Test H** | `scripts/fetch-fedora-riscv-rootfs.sh`, `build-fedora-kde-rootfs.sh`, `update-initramfs-fedora.sh`, `package-fedora-kde-image.sh` | Static scan for `--nogpgcheck`, `--nosignature`, `gpgcheck=0`, `repo_gpgcheck=0`, `rpm --nodeps` | Zero signature bypasses | `0` bypasses found across 4 Fedora scripts | `0` | **PASS** |
