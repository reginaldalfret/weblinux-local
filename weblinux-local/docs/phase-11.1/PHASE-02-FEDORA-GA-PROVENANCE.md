# Phase 11.1.1 — Fedora 45 GA RISC-V Provenance

**Date:** 2026-11-27  
**Architecture:** `riscv64` (`RV64GC` / `LP64D`, community-maintained secondary architecture)

---

## 1. GA Release Investigation

Checked authoritative Fedora RISC-V sources:
- Announcement: `https://discussion.fedoraproject.org/t/fedora-45-risc-v-ga-images-are-available/206919` — *"Fedora 45 RISC-V GA images are available!"* (notes RISC-V is a **secondary arch, community-maintained**, and points to `https://dl.fedoraproject.org/pub/alt/risc-v/releases/45`).
- Release directory: `https://dl.fedoraproject.org/pub/alt/risc-v/releases/45/Container/riscv64/images/` (also aliased at `/pub/alt/risc-v/release/45/Container/riscv64/images/`).

### Available Container Artifacts at `releases/45/Container/riscv64/images/`
- `Fedora-Container-Base-Generic-45-20261022.0.riscv64.oci.tar.xz`
- `Fedora-Container-Base-Generic-45-20261022.0.riscv64.oci.tar.xz.sha256`
- `Fedora-Container-Base-Generic-Minimal-45-20261022.0.riscv64.oci.tar.xz` (+ `.sha256`)
- `Fedora-Container-Toolbox-45-20261022.0.riscv64.oci.tar.xz` (+ `.sha256`)

Also checked `releases/45/Cloud/riscv64/images/` and `releases/45/Server/riscv64/images/`: all GA images carry the exact `45-20261022.0.riscv64` compose identifier and `.sha256` checksum files, with **no detached `.asc` PGP signature files**.

### Published Checksum
```
bfc2ad635a352818a8d250fde1175193f76a96ace071b569f67abd3124020f8e  Fedora-Container-Base-Generic-45-20261022.0.riscv64.oci.tar.xz
```

---

## 2. Comparison with Existing WebLinux Build

- **Existing Phase 11 artifact:** `Fedora-Container-Base-Generic-45-20261022.0.riscv64.oci.tar.xz`
- **Existing Phase 11 SHA-256:** `bfc2ad635a352818a8d250fde1175193f76a96ace071b569f67abd3124020f8e`
- **Result:** The existing Phase 11 base image is **byte-for-byte identical** to the published Fedora 45 RISC-V GA Container Base artifact under `releases/45/`. No newer GA container tarball exists.
- **Note on `/etc/os-release`:** The upstream GA container tarball ships `fedora-release-common-45-0.10.noarch`, which sets `VERSION="45 (Container Image Prerelease)"` and `RELEASE_TYPE=development`. Although `fedora-release-common-45-13.noarch` exists in `[fedora]` on `riscv-koji.fedoraproject.org`, it is unsigned (see `PHASE-01-REPOSITORY-TRUST-AUDIT.md`) and therefore is **not** applied to the persistent production disk.

---

## 3. Integrity vs. Authenticity Distinction

- **Integrity verification:** **PASS** — Verified via `sha256sum -c` over HTTPS from `dl.fedoraproject.org`.
- **Publisher authenticity (OpenPGP):** **PASS WITH LIMITATION** — No detached `.asc` signature or PGP-signed `CHECKSUM` file is published in `dl.fedoraproject.org/pub/alt/risc-v/releases/45/`. Authenticity relies on HTTPS/TLS transport to Fedora's `dl.fedoraproject.org` infrastructure rather than an offline OpenPGP signature.
- **Production promotion decision:** Retain the existing verified `20261022.0` base rootfs (already matching the GA Container Base artifact) and apply security hardening in-place via RPM GPG key import + DNF5 `/etc/dnf/repos.override.d/` overrides without installing any unsigned packages.
