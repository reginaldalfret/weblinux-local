# Phase 11.1.3 — RPM Signature Enforcement

**Date:** 2026-11-27  
**Target:** Fedora 45 RISC-V (`riscv64`)

---

## 1. DNF5 Configuration Hardening

Package-owned repository files under `/usr/share/dnf5/repos.d/` (`fedora.repo`, `fedora-staging.repo`, `fedora-koji.repo`) were preserved untouched. Redundant copies previously placed in `/etc/yum.repos.d/` were removed, and native DNF5 overrides were applied via `/etc/dnf/repos.override.d/99-weblinux-security.repo`:

- `[fedora]`: `enabled=1`, `gpgcheck=1`, `sslverify=1`, `skip_if_unavailable=0`, `gpgkey=file:///usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary`
- `[fedora-staging]`: `enabled=0`, `gpgcheck=1`, `sslverify=1`
- `[fedora-koji]`: `enabled=0`, `gpgcheck=1`, `sslverify=1`
- `[fedora-debuginfo]`, `[fedora-source]`, `[fedora-staging-debuginfo]`, `[fedora-staging-source]`: `enabled=0`, `gpgcheck=1`, `sslverify=1`

Verified Fedora 45 signing key (`4F50 A611 4CD5 C697 6A7F 1179 655A 4B02 F577 861E`) was imported into the RPM database:
```
gpg-pubkey-4f50a6114cd5c6976a7f1179655a4b02f577861e-6888bc98	Fedora (45) <fedora-45-primary@fedoraproject.org> public key
```

---

## 2. Effective Configuration Verification

`dnf5 --installroot="$R" --forcearch=riscv64 --releasever=45 repo list --all`:
- `fedora`: `enabled`
- `fedora-staging`, `fedora-koji`, `*-debuginfo`, `*-source`: `disabled`

`dnf5 --installroot="$R" --forcearch=riscv64 --releasever=45 repo info fedora`:
- `Skip if unavailable : false`
- `Base URL            : https://riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/`
- `Keys                : file:///usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary`
- `Verify repodata     : false`
- `Verify packages     : true`

---

## 3. Fail-Closed Behavior on Unsigned Community Packages

Because `riscv-koji.fedoraproject.org` currently publishes unsigned RPMs (`Header OpenPGP signature: NOTFOUND`), enabling `gpgcheck=1` causes DNF5 to **fail closed** and reject any unsigned package installation or upgrade from `fedora` rather than silently accepting unauthenticated binaries.
