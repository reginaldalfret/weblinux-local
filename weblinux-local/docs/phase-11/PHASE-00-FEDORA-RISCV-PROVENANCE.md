# Phase 11 — Fedora 45 RISC-V Provenance & Integrity

## 1. Official Source & Selected Artifact

- **Distribution:** Fedora 45 RISC-V (Community Secondary Architecture)
- **Official Source URL:** `https://dl.fedoraproject.org/pub/alt/risc-v/release/45/Container/riscv64/images/`
- **Selected Artifact:** `Fedora-Container-Base-Generic-45-20261022.0.riscv64.oci.tar.xz`
- **Archive Size:** `74.54 MiB` compressed (`204 MiB` extracted rootfs)
- **Published SHA-256 (`...oci.tar.xz.sha256`):** `bfc2ad635a352818a8d250fde1175193f76a96ace071b569f67abd3124020f8e`
- **Verification Result:** `sha256sum -c`: **OK**
- **Extracted OCI Layer Digest:** `90c9bb9b37e84bac293628d698e9e3cac95da0a930e8c3f45cfe24c909d2479a`

## 2. Repository & Signing Key Configuration

- **Installed Repo Package:** `fedora-repos-45-0.5.2.riscv64.noarch`, `fedora-gpg-keys-45-0.5.2.riscv64.noarch`
- **Repo Definitions (`/usr/share/dnf5/repos.d/`):**
  - `fedora`: `https://riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/`
  - `fedora-staging`: `https://riscv-koji.fedoraproject.org/repos-dist/f45-staging/latest/riscv64/`
  - `fedora-koji`: `https://riscv-koji.fedoraproject.org/repos/f45-build/latest/riscv64/`
- **Fedora 45 Key:** `/usr/share/pki/rpm-gpg/RPM-GPG-KEY-45-fedora`
