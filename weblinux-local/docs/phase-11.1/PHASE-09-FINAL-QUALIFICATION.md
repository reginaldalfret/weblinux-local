# Phase 11.1.8 — Final Security & Release Qualification

**Date:** 2026-11-27  
**Branch:** `feature/runtime-foundations`  
**Distribution:** Fedora 45 RISC-V (`riscv64` / `RV64GC` / `LP64D`) + KDE Plasma 6.7.4

---

## 1. Security Category Scorecard

| Category | Status | Summary |
|---|---|---|
| **Fedora 45 GA Provenance** | **PASS WITH LIMITATION** | Existing `Fedora-Container-Base-Generic-45-20261022.0.riscv64.oci.tar.xz` (`sha256: bfc2ad635a352818a8d250fde1175193f76a96ace071b569f67abd3124020f8e`) matches the official `releases/45/` GA Container Base artifact. Limitation: no detached `.asc` PGP signature is published by Fedora RISC-V for the container tarball. |
| **GPG Key Trust Establishment** | **PASS** | `RPM-GPG-KEY-fedora-45-primary` (`rsa4096/655A4B02F577861E`, fingerprint `4F50 A611 4CD5 C697 6A7F 1179 655A 4B02 F577 861E`) verified against `https://fedoraproject.org/ga/security/` and imported into the guest RPM DB. |
| **RPM Signature Enforcement** | **PASS** | `/etc/dnf/repos.override.d/99-weblinux-security.repo` enforces `gpgcheck=1`, `sslverify=1`, `skip_if_unavailable=0` on `[fedora]`, disables `fedora-staging` and `fedora-koji`, and removes shadowed `/etc/yum.repos.d/*.repo` copies. |
| **Upstream Community Repo Signing** | **BLOCKED (Upstream)** | `https://riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/` serves **unsigned** RPMs (`0 / 717` installed RPMs signed; `0 / 13` sampled repo RPMs signed) and unsigned `repomd.xml` (`404` on `repomd.xml.asc`). Per policy, `gpgcheck=1` remains enforced so unsigned updates fail closed. |
| **Negative Signature Test Suite** | **PASS** | `tests/test-phase11-1-fedora-signatures.js`: **8/8 PASS** (valid signed RPM, unsigned RPM rejection, wrong-key RPM rejection, corrupted RPM rejection, metadata limitation, staging isolation, DNF config regression, script scan). |
| **Security Updates** | **PASS** | Dry-run `dnf5 upgrade --refresh --assumeno` proposed 3 unsigned `fedora-release-*` (`0:45-13`) packages; not applied because they lack OpenPGP signatures. |
| **Runtime, Desktop, Net & Persistence** | **PASS** | `tests/test-phase11-1-runtime-regression.js` passed (`COLD=26.0s`, `WARM=53.8s`, `SHA256=284ef875ac6142daaf0781f305f1aed12edc12213ccecc2e3894a95991362501`, `RFC1918_BLOCKED_OK`, Plasma 6.7.4 + Konsole + Dolphin verified). |
| **Build, Typecheck & Other Distros** | **PASS** | `npx tsc --noEmit` (`exit 0`), `npm run build` (`exit 0`), `test-phase8-networking.js` (`exit 0`), and Debian/Ubuntu/Arch/openSUSE manifests/disks untouched. |

---

## 2. Production Promotion Decision

- The hardened Fedora 45 RISC-V KDE image (`fullImageSha256: 852661e6fa2fbdec4b0e41a75daaf272a994bc3cb948cea63e7606406fe6a754`, `UUID: 14dca0d4-ba28-4de2-86df-ae7c470fa7bc`) passed all runtime, signature-enforcement, negative-testing, persistence, and cross-distribution gates and is promoted with **explicit documented upstream limitations**:
  1. Fedora 45 RISC-V (`riscv-koji.fedoraproject.org`) is a community-maintained secondary architecture whose Koji dist-repo RPMs and `repomd.xml` are currently unsigned.
  2. With `gpgcheck=1` enforced, live `dnf5 install`/`upgrade` against `riscv-koji` fails closed unless upstream begins OpenPGP-signing `riscv64` RPMs.
