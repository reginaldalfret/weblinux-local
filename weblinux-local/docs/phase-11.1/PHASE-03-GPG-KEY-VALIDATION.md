# Phase 11.1.2 — Fedora GPG Trust Establishment

**Date:** 2026-11-27  
**Authoritative Verification Source:** `https://fedoraproject.org/ga/security/` (and `https://fedoraproject.org/en/security/`)

---

## 1. Official Fedora 45 Signing Key Verification

Queried `https://fedoraproject.org/ga/security/` directly:
- **Key Label:** `Fedora 45`
- **Key ID:** `rsa4096/655A4B02F577861E`
- **Created:** `2025-07-29`
- **Published Fingerprint:** `4F50 A611 4CD5 C697 6A7F 1179 655A 4B02 F577 861E`

Inspected the packaged key file inside `/root/fedora-build/rootfs/usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary` (`fedora-gpg-keys-45-0.5.2.riscv64.noarch`) using `gpg --show-keys --with-fingerprint`:
```
pub   rsa4096 2025-07-29 [SCE]
      4F50 A611 4CD5 C697 6A7F  1179 655A 4B02 F577 861E
uid                      Fedora (45) <fedora-45-primary@fedoraproject.org>
```
Exact 160-bit fingerprint match confirmed (`4F50 A611 4CD5 C697 6A7F 1179 655A 4B02 F577 861E`).

---

## 2. Key Inventory & RPM Database State

- **Packaged key file:** `/usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary` (1672 bytes).
- **Symlinks present:** `RPM-GPG-KEY-45-fedora`, `-aarch64`, `-ppc64le`, `-s390x`, `-x86_64` -> `RPM-GPG-KEY-fedora-45-primary`.
- **Missing symlink:** `RPM-GPG-KEY-fedora-45-riscv64` is not shipped by `fedora-gpg-keys-45-0.5.2.riscv64.noarch`, so DNF5 `gpgkey=` references must point explicitly to `file:///usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary` (not `$basearch`).
- **RPM DB baseline state:** `rpm --root "$R" -q gpg-pubkey` returned no imported keys prior to Phase 11.1 remediation.
- **Remediation:** Import `/usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary` directly into the Fedora rootfs RPM DB via `rpmkeys --root "$R" --import` (no external keyservers or automatic repo key imports used).
