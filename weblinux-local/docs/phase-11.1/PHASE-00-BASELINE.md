# Phase 11.1.0 — Baseline and Security Inventory

**Date:** 2026-11-27  
**Branch:** `feature/runtime-foundations`  
**Verified HEAD at start:** `28d4d999caccf820bf557e3f39072f1211d7f86f` (`origin/feature/runtime-foundations`)  
**Target Environment:** Fedora 45 RISC-V (`riscv64` / `RV64GC` / `LP64D`) + KDE Plasma 6.7.4

---

## 1. Repository, Disk, and Runtime Baseline

- **Git state:** `feature/runtime-foundations` tracking `origin/feature/runtime-foundations` at `28d4d99` (`docs(fedora): publish Phase 11 qualification reports`). Unrelated pre-existing working-tree modifications exist in `tests/screenshots/phase6-kde/*`, `tests/screenshots/phase7-gpu/*`, and `../.phase9-build/` and are preserved untouched.
- **Storage capacity:** `D:` has `34.48 GiB` free; `E:` has `67.90 GiB` free.
- **OPFS Disk Identities (`runtime/adapters/WasmLinuxAdapter.ts`):**
  - Root disk: `root-fedora-kde` (line 370) -> mounted at `/fedora` (`/dev/wda`)
  - Home disk: `home-fedora-kde` (line 377) -> mounted at `/fedora/root` (`/dev/wdb`)
  - Chunk source: `/disk/fedora-kde/` (line 355), `3328` x 1 MiB chunks (`1927` non-zero, `64` boot), `fullImageSha256: 41ce9df26a9a1137ed159e78bae59b6ee39b05d6d462383ce74d61b426cb2bbc`, `filesystemUuid: 5426ccde-a921-48ad-bb5d-e96b5126ae63`.
- **Network Security Boundary (`scripts/guest-net-relay.js`):**
  - Binds exclusively to `127.0.0.1:8081` (line 23), enforces Origin allowlist (`localhost:3000`, `127.0.0.1:3000`, `localhost:5173`, `127.0.0.1:5173`, lines 26-31), drops non-ARP/non-IPv4 frames, and blocks RFC1918, loopback, link-local, and multicast destinations (`isBlockedIp`, lines 37-45).
- **Existing Distributions Preserved:** `debian-13-firefox`, `ubuntu-24.04-kde-epiphany`, `arch-kde`, `opensuse-tumbleweed-kde`.

---

## 2. Installed Fedora Userspace & RPM/DNF5 Inventory

Inspected inside `/root/fedora-build/rootfs` (WSL `Fedora-45`):

- `/etc/os-release`: `NAME="Fedora Linux"`, `VERSION="45 (Container Image Prerelease)"`, `RELEASE_TYPE=development`, `VERSION_ID=45`, `PRETTY_NAME="Fedora Linux 45 (Container Image Prerelease)"`.
- Total installed RPMs: `717`.
- Core identity/package-manager RPMs:
  - `fedora-release-common-45-0.10.noarch`
  - `fedora-release-container-45-0.10.noarch`
  - `fedora-release-identity-container-45-0.10.noarch`
  - `fedora-repos-45-0.5.2.riscv64.noarch`
  - `fedora-gpg-keys-45-0.5.2.riscv64.noarch`
  - `rpm-6.1.0-1.fc45.riscv64`
  - `dnf5-5.4.3.0-2.fc45.riscv64`
- Imported RPM GPG keys (`rpm --root "$R" -q gpg-pubkey`): **None imported** (`exit 1`).
- `/etc/dnf/dnf.conf`:
  ```ini
  [main]
  tsflags=nodocs
  ```
- `/etc/dnf/repos.override.d/` and `/etc/dnf/libdnf5.conf.d/`: Empty.
- `/etc/pki/rpm-gpg/`: Empty (Fedora 45 relocates packaged keys to `/usr/share/pki/rpm-gpg/`).
- `/usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary`: Present (`1672` bytes), fingerprint `4F50 A611 4CD5 C697 6A7F  1179 655A 4B02 F577 861E` (`Fedora (45) <fedora-45-primary@fedoraproject.org>`). Note: symlinks exist for `aarch64`, `ppc64le`, `s390x`, `x86_64`, and `RPM-GPG-KEY-45-fedora`, but not `RPM-GPG-KEY-fedora-45-riscv64`.

---

## 3. Repository & Signature Bypass Search Findings

### Project-wide grep (`gpgcheck=0|repo_gpgcheck=0|--nogpgcheck|--nosignature|--nodigest|--no-verify|rpm --nodeps`)

Only documentation references from Phase 11 were found in the workspace repo:
- `docs/phase-11/PHASE-04-DNF5-AND-RPM.md:20` — notes upstream `fedora-repos-45-0.5.2.riscv64.noarch` shipped `gpgcheck=0`.
- `docs/phase-11/PHASE-12-FINAL-QUALIFICATION.md:6` — notes upstream `f45` prerelease repos ship with `gpgcheck=0`.

No WebLinux build script (`scripts/fetch-fedora-riscv-rootfs.sh`, `scripts/build-fedora-kde-rootfs.sh`, `scripts/package-fedora-kde-image.sh`, `scripts/update-initramfs-fedora.sh`) passes `--nogpgcheck`, `--nosignature`, `--nodigest`, `--no-verify`, or `rpm --nodeps`.

### Detailed Findings Table

| # | File Path | Line(s) | Current Setting | Origin | Security Impact | Recommended Remediation | Test Required |
|---|---|---|---|---|---|---|---|
| 1 | `/usr/share/dnf5/repos.d/fedora.repo` (and copy `/etc/yum.repos.d/fedora.repo`) | `[fedora]` lines 1-6 | `enabled=1`, `gpgcheck=0`, `baseurl=https://riscv-koji.fedoraproject.org/repos-dist/f$releasever/latest/$basearch/`, no `gpgkey=`, no `skip_if_unavailable` | Packaged by `fedora-repos-45-0.5.2.riscv64.noarch` | **High:** DNF5 skips OpenPGP package signature verification (`Warning: skipped OpenPGP checks`), allowing tampered or unsigned RPMs from the repo or MITM/compromised mirror to be installed. | Evaluate Fedora 45 GA repos/signatures; enforce `gpgcheck=1`, `sslverify=1`, `skip_if_unavailable=False`, and `gpgkey=file:///usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary` via `/etc/dnf/repos.override.d/` (or GA `fedora-repos`). | Negative signature suite (unsigned, wrong-key, corrupted RPM rejection) + `dnf5 upgrade --refresh --assumeno`. |
| 2 | `/usr/share/dnf5/repos.d/fedora-staging.repo` (and copy `/etc/yum.repos.d/fedora-staging.repo`) | `[fedora-staging]` lines 1-6 | `enabled=1`, `gpgcheck=0`, `priority=98`, `baseurl=https://riscv-koji.fedoraproject.org/repos-dist/f$releasever-staging/latest/$basearch/` | Packaged by `fedora-repos-45-0.5.2.riscv64.noarch` | **High:** Staging repo is enabled by default with higher priority (`98 < 99`) than `[fedora]` and `gpgcheck=0`, allowing unverified staging packages to override base packages. | Disable `[fedora-staging]` in production (`enabled=0`) via `/etc/dnf/repos.override.d/` unless explicitly verified and required. | Repository downgrade/staging isolation test + `dnf5 repolist`. |
| 3 | `/usr/share/dnf5/repos.d/fedora-koji.repo` (and copy `/etc/yum.repos.d/fedora-koji.repo`) | `[fedora-koji]` lines 1-6 | `enabled=0`, `gpgcheck=0`, `priority=97` | Packaged by `fedora-repos-45-0.5.2.riscv64.noarch` | **Low (currently disabled):** Koji buildroot repo has `gpgcheck=0`; must remain `enabled=0` in production. | Keep `enabled=0`; ensure no production script enables it without signature verification. | `dnf5 repolist` confirms `fedora-koji` is disabled. |
| 4 | `scripts/build-fedora-kde-rootfs.sh` | 43-44 | `cp -n "$R/usr/share/dnf5/repos.d/"*.repo "$R/etc/yum.repos.d/"` | Phase 11 build script | **Medium:** Duplicates `/usr/share/dnf5/repos.d/*.repo` into `/etc/yum.repos.d/`, which can shadow packaged `/usr/share/dnf5/repos.d/` updates and propagate `gpgcheck=0`. | Remove unnecessary duplication or replace with explicit `/etc/dnf/repos.override.d/` hardening overrides and fail-closed GPG verification during rootfs build. | Script regression check + rootfs build validation. |
| 5 | `RPM DB` (`/usr/lib/sysimage/rpm`) | N/A | Zero `gpg-pubkey` entries imported | Container Base + Phase 11 build | **High:** Without importing the verified Fedora 45 GPG key into RPM DB, `rpm -Kv` / `rpmkeys --checksig` reports `NOKEY` for signed Fedora RPMs. | Independently verify `RPM-GPG-KEY-fedora-45-primary` fingerprint (`4F50 A611 4CD5 C697 6A7F 1179 655A 4B02 F577 861E`) and import via `rpmkeys --import`. | `rpmkeys --checksig` on critical packages returns `digests signatures OK`. |
| 6 | `scripts/fetch-fedora-riscv-rootfs.sh` | 5-18 | Fetches `Fedora-Container-Base-Generic-45-20261022.0.riscv64.oci.tar.xz` and verifies `.sha256` only (no detached `.asc`/GPG check; prerelease artifact). | Phase 11 acquisition script | **Medium:** Integrity (SHA-256) is checked, but publisher authenticity (PGP signature on `CHECKSUM` file) is not checked, and image is prerelease `20261022.0`. | Investigate Fedora 45 GA RISC-V artifacts, check for signed `CHECKSUM` files, and verify against Fedora 45 signing key. | Provenance & checksum/GPG verification audit. |
