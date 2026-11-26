# Phase 11 — RPM & DNF5 Configuration

## 1. Verified Package Stack

- **RPM:** `RPM version 6.1.0`
- **DNF5:** `dnf5 version 5.4.3.0` (`dnf5 plugin API version 2.0`)
- **Installed Package Count:** `717` (`docs/phase-11/fedora-kde-packages.lock`)

## 2. Repository Configuration (`/usr/share/dnf5/repos.d/` & `/etc/yum.repos.d/`)

| Repo ID | Name | Status | Base URL |
|---|---|---|---|
| `fedora` | `Fedora RISC-V 45` | `enabled` | `https://riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/` |
| `fedora-staging` | `Fedora RISC-V 45 - Staging` | `enabled` | `https://riscv-koji.fedoraproject.org/repos-dist/f45-staging/latest/riscv64/` |
| `fedora-koji` | `Fedora RISC-V 45 - Koji` | `disabled` | `https://riscv-koji.fedoraproject.org/repos/f45-build/latest/riscv64/` |

## 3. Signing & Prerelease Note

- `fedora-gpg-keys-45-0.5.2.riscv64.noarch` provides `/usr/share/pki/rpm-gpg/RPM-GPG-KEY-45-fedora`.
- The upstream `fedora-repos-45-0.5.2.riscv64.noarch` repo definitions ship with `gpgcheck=0` for the prerelease Koji `f45` compose (`Warning: skipped OpenPGP checks for 564 packages from repository: fedora`). This upstream configuration was preserved without weakening any existing signatures.
