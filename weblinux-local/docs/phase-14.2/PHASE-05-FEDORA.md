# Phase 14.2 — Fedora 45 RISC-V Browser Verification (`PHASE-05-FEDORA.md`)

**Status:** **BLOCKED** (Fail-Closed Security Policy Preserved)  
**Policy:** Phase 11.1 `gpgcheck=1` is strictly enforced. `--nogpgcheck` and unsigned RPMs are prohibited.

---

## 1. Live Upstream Repository & Mirror Verification

All endpoints below were queried live from WSL via `curl` / Python `urllib` on 2026-11-27 (`2026-11-28T01:07+05:30`):

| Endpoint | HTTP Status | Findings |
|---|---|---|
| `https://dl.fedoraproject.org/pub/fedora-secondary/releases/45/Everything/riscv64/os/repodata/repomd.xml` | `404` | No Fedora 45 `riscv64` release repository |
| `https://dl.fedoraproject.org/pub/fedora-secondary/development/rawhide/Everything/riscv64/os/repodata/repomd.xml` | `404` | No Rawhide `riscv64` repository on `fedora-secondary` |
| `https://dl.fedoraproject.org/pub/alt/risc-v/release/45/` | `200` | Contains only `Cloud/`, `Container/`, `Server/` |
| `https://dl.fedoraproject.org/pub/alt/risc-v/release/45/Everything/riscv64/os/repodata/repomd.xml` | `404` | No `Everything` RPM repository under `alt/risc-v/release/45/` |
| `https://dl.fedoraproject.org/pub/alt/risc-v/release/45/Server/riscv64/os/repodata/repomd.xml` | `404` | `Server/riscv64/` contains only `images/` |
| `https://dl.fedoraproject.org/pub/alt/risc-v/repo/` | `404` | No `alt/risc-v/repo/` tree |
| `https://kojipkgs.fedoraproject.org/repos/f45-build/latest/riscv64/repodata/repomd.xml` | `404` | No `f45-build` `riscv64` repo on `kojipkgs` |
| `https://mirrors.fedoraproject.org/metalink?repo=fedora-45&arch=riscv64` | `404` | MirrorManager returns `repo = fedora-45 arch = riscv64 error: invalid repo or arch` |
| `https://riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/repodata/repomd.xml` | `200` | Koji dist-repo metadata exists (`primary`: `e6e6d3ae16683a20105d603f88fccbb04086b9daa0c2ac5845eeabcf720742bf-primary.xml.zst`) |
| `https://riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/repodata/repomd.xml.asc` | `404` | Repository metadata is **unsigned** (no `.asc` signature) |

---

## 2. Browser Package Inventory & GPG Signature Check

Inspecting `repodata/e6e6d3ae16683a20105d603f88fccbb04086b9daa0c2ac5845eeabcf720742bf-primary.xml.zst` from `https://riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/` for `epiphany`, `falkon`, `firefox`, and `chromium`:

| Package | Version-Release.Arch | Location in `riscv-koji` | `chromium` Status |
|---|---|---|---|
| `epiphany` | `51~beta-1.fc45.riscv64` | `Packages/e/epiphany-51~beta-1.fc45.riscv64.rpm` | — |
| `falkon` | `26.08.0-1.fc45.riscv64` | `Packages/f/falkon-26.08.0-1.fc45.riscv64.rpm` | — |
| `firefox` | `154.0-5.fc45.riscv64` | `Packages/f/firefox-154.0-5.fc45.riscv64.rpm` | — |
| `chromium` | Not present | — | Absent from `f45/latest/riscv64` |

Downloading `Packages/f/falkon-26.08.0-1.fc45.riscv64.rpm` and running `rpm -Kv` in WSL returned **exit code `1`**:

```text
    Header OpenPGP DSA signature: NOTFOUND
    Header OpenPGP RSA signature: NOTFOUND
    Header OpenPGP signature: NOTFOUND
    Header SHA256 digest: OK
    Payload SHA256 digest: OK
    Legacy OpenPGP DSA signature: NOTFOUND
    Legacy OpenPGP RSA signature: NOTFOUND
```

All `riscv-koji` `f45/latest/riscv64` RPMs remain **unsigned** (consistent with Phase 11.1 `SIGNED_COUNT=0 / 717`).

---

## 3. Fail-Closed Installer Script

Implemented `weblinux-local/scripts/install-fedora-browser.sh` (validated with `bash -n`, exit code `0`):
- Verifies the Fedora 45 primary GPG key fingerprint (`4F50A6114CD5C6976A7F1179655A4B02F577861E`) and imports it via `rpmkeys`.
- Confirms `/etc/dnf/repos.override.d/99-weblinux-security.repo` has `gpgcheck=1`.
- Probes official Fedora 45 `riscv64` release endpoints for `repomd.xml` + `repomd.xml.asc`.
- Invokes `dnf5` with `--setopt=gpgcheck=1 --setopt=sslverify=1 --setopt=skip_if_unavailable=0` (never `--nogpgcheck`), failing closed and refusing installation when upstream RPMs lack valid OpenPGP signatures.
- Includes a post-install `rpm -q` OpenPGP signature verification guard that immediately removes any package lacking a valid signature.

---

## 4. Conclusion

Fedora 45 KDE browser support remains **BLOCKED** by upstream Fedora infrastructure: no GPG-signed Fedora 45 `riscv64` package repository or browser RPM (`epiphany`, `falkon`, `firefox`, `chromium`) exists. Per Phase 11.1 security policy, `gpgcheck=1` is preserved and unsigned `riscv-koji` RPMs are refused.
