# Phase 11.1.0 / 11.1.3 — Repository Trust Audit

**Date:** 2026-11-27  
**Target:** Fedora 45 RISC-V (`riscv64`)

---

## 1. Root Cause of `gpgcheck=0`

Inspection of `/root/fedora-build/rootfs` and live queries against `https://riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/` established **why** `gpgcheck=0` was configured:

1. **Packaged upstream configuration:** `fedora-repos-45-0.5.2.riscv64.noarch` installs `/usr/share/dnf5/repos.d/fedora.repo`, `fedora-staging.repo`, and `fedora-koji.repo` with `gpgcheck=0` and `enabled=1` on both `[fedora]` and `[fedora-staging]`.
2. **Primary mirrors do not carry `riscv64`:** Querying `https://mirrors.fedoraproject.org/metalink?repo=fedora-45&arch=riscv64` returns:
   `<!-- # repo = fedora-45 arch = riscv64 error: invalid repo or arch -->`.
3. **Koji dist-repos serve unsigned RPMs:**
   - Checking all `717` installed RPMs in `/root/fedora-build/rootfs` via `rpm -qa --qf '%{NAME} %{RSAHEADER:pgpsig} %{DSAHEADER:pgpsig} %{SIGPGP:pgpsig} %{SIGGPG:pgpsig}\n'`: **`SIGNED_COUNT=0 / 717`**.
   - Downloading `13` representative critical RPMs directly from `https://riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/` (`dbus-daemon`, `dnf5`, `dolphin`, `fedora-gpg-keys`, `fedora-release-common`, `fedora-repos`, `glibc`, `konsole`, `kwin`, `mesa-dri-drivers`, `plasma-workspace`, `qt6-qtbase`, `rpm`) and running `rpm -Kv` confirmed every package has `Header SHA256 digest: OK` and `Payload SHA256 digest: OK`, but **`Header OpenPGP signature: NOTFOUND`** and **`Legacy OpenPGP RSA signature: NOTFOUND`**.
4. **Repository metadata is unsigned:** Inspecting `https://riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/repodata/` and `f45-staging/latest/riscv64/repodata/` showed `repomd.xml` without `repomd.xml.asc`.

---

## 2. Repository Classification

| Repo ID | Base URL | Upstream State | Classification | Production Policy |
|---|---|---|---|---|
| `fedora` | `https://riscv-koji.fedoraproject.org/repos-dist/f$releasever/latest/$basearch/` | `enabled=1`, `gpgcheck=0`, `priority=99` | Community secondary-arch Koji dist-repo (unsigned RPMs, unsigned repomd, HTTPS TLS) | Enforce `gpgcheck=1`, `sslverify=1`, `skip_if_unavailable=0`, `gpgkey=file:///usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary` via `/etc/dnf/repos.override.d/`. DNF5 fails closed on unsigned RPMs. |
| `fedora-staging` | `https://riscv-koji.fedoraproject.org/repos-dist/f$releasever-staging/latest/$basearch/` | `enabled=1`, `gpgcheck=0`, `priority=98` | Staging repo (currently contains `shim-unsigned-riscv64-15.8-3.1.riscv64`) | **Disable** (`enabled=0`, `gpgcheck=1`, `sslverify=1`) via `/etc/dnf/repos.override.d/`. |
| `fedora-koji` | `https://riscv-koji.fedoraproject.org/repos/f$releasever-build/latest/$basearch/` | `enabled=0`, `gpgcheck=0`, `priority=97` | Koji buildroot repo | Keep **disabled** (`enabled=0`, `gpgcheck=1`, `sslverify=1`). |
| `*-debuginfo`, `*-source` | `riscv-koji.fedoraproject.org` | `enabled=0`, `gpgcheck=0` | Debug/source repos | Keep **disabled** (`enabled=0`, `gpgcheck=1`, `sslverify=1`). |

---

## 3. Metadata Authenticity Limitation

Because `riscv-koji.fedoraproject.org` does not publish `repomd.xml.asc` or a dedicated Koji metadata-signing key:
- `repo_gpgcheck=1` cannot be enabled without breaking all `dnf5` metadata refreshes.
- HTTPS (`sslverify=1`) provides transport integrity/authentication to `riscv-koji.fedoraproject.org`, **not** end-to-end OpenPGP repository metadata authenticity.
- With `gpgcheck=1` enforced in `/etc/dnf/repos.override.d/99-weblinux-security.repo`, unsigned packages from `riscv-koji` are **blocked from installation/upgrade** (fail-closed) rather than silently accepted.
