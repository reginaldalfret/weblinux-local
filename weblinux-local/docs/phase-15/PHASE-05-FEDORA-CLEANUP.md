# Phase 15 — Fedora 45 KDE Browser-Free & Security Verification (`PHASE-05-FEDORA-CLEANUP.md`)

**Status:** **PASS (Clean Browser-Free State & Fail-Closed Security Preserved)**  
**Manifest:** `weblinux-local/apps/web/public/manifests/fedora-kde.json` (`id: fedora-kde`, `architecture: riscv64`, `totalSizeBytes: 3489660928`, `chunksCount: 3328`)  
**Verification Script:** `weblinux-local/scripts/verify-fedora-no-browser.sh`

---

## 1. Context & Browser-Free Baseline

In Phase 14.2 (`docs/phase-14.2/PHASE-05-FEDORA.md`), `scripts/install-fedora-browser.sh` enforced fail-closed RPM/DNF5 signature verification (`gpgcheck=1`, `sslverify=1`, `skip_if_unavailable=0`, never `--nogpgcheck`). Because upstream Fedora 45 `riscv64` repositories lacked GPG-signed metadata and signed browser RPMs, no browser package was ever installed into the `fedora-kde` rootfs.

Phase 15 verification confirms that `/root/fedora-build/rootfs` remains completely browser-free and retains all Phase 11.1 / 14.2 security hardening without requiring destructive removal or multi-GiB ext4 reconstruction.

---

## 2. Preserved `gpgcheck=1` Security Configuration

The Fedora 45 KDE rootfs preserves fail-closed repository trust in `/etc/dnf/repos.override.d/99-weblinux-security.repo`:

- `[fedora]`: `enabled=1`, `gpgcheck=1`, `sslverify=1`, `skip_if_unavailable=0`, `gpgkey=file:///usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary`
- `[fedora-staging]`, `[fedora-koji]`, `[fedora-debuginfo]`, `[fedora-source]`, `[fedora-staging-debuginfo]`, `[fedora-staging-source]`: `enabled=0`, `gpgcheck=1`, `sslverify=1`
- Primary GPG key present at `/usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary` (expected fingerprint `4F50A6114CD5C6976A7F1179655A4B02F577861E` per `build-fedora-kde-rootfs.sh` and `install-fedora-browser.sh`).
- Zero `gpgcheck=0` or `sslverify=0` directives exist under `/etc/dnf`, `/etc/dnf/repos.override.d`, or `/etc/yum.repos.d`.

---

## 3. Browser Removal & Retained Tooling Audit

| Check | Target | Observed Result |
|---|---|---|
| Browser RPMs (`firefox`, `epiphany`, `falkon`, `chromium`) | `rpm --root /root/fedora-build/rootfs -q` | Absent (all 4 not installed) |
| Browser binaries (`firefox`, `epiphany`, `falkon`, `chromium`, `chromium-browser`) | `/root/fedora-build/rootfs/usr/bin/` | Absent |
| WebLinux browser wrapper | `/root/fedora-build/rootfs/usr/local/bin/weblinux-browser` | Absent |
| WebLinux browser desktop entry | `/root/fedora-build/rootfs/usr/share/applications/weblinux-browser.desktop` | Absent |
| Retained `curl` | `/usr/bin/curl` | Present (`curl-8.21.0-1.rvre0.fc45.riscv64`) |
| Retained `git` | `/usr/bin/git` | Present (`git-core-2.55.0-2.fc45.riscv64`) |
| Retained `dnf5` | `/usr/bin/dnf5` | Present (`dnf5-5.4.3.0-2.fc45.riscv64`) |
| `wget` availability | `/usr/bin/wget` | Not present in `Fedora-Container-Base-Generic-45-20261022.0.riscv64.oci.tar.xz` (`curl` is retained) |

---

## 4. Automated Verification (`verify-fedora-no-browser.sh`)

`weblinux-local/scripts/verify-fedora-no-browser.sh` supports both mounted rootfs verification (defaulting to `/root/fedora-build/rootfs` or an explicit path argument) and live guest verification (pass `/`).

- Syntax check: `wsl bash -n /mnt/e/Web-Linux/weblinux-local/scripts/verify-fedora-no-browser.sh` -> exit code `0`.
- Execution against mounted rootfs: `wsl bash /mnt/e/Web-Linux/weblinux-local/scripts/verify-fedora-no-browser.sh /root/fedora-build/rootfs` -> exit code `0`:

```text
=== WebLinux Phase 15: Fedora 45 KDE No-Browser Verification ===
Target rootfs: /root/fedora-build/rootfs
[PASS] Fedora 45 identity verified (/root/fedora-build/rootfs/etc/os-release)
[PASS] DNF5 security override enforces gpgcheck=1 (/root/fedora-build/rootfs/etc/dnf/repos.override.d/99-weblinux-security.repo)
[PASS] DNF5 security override enforces sslverify=1 (/root/fedora-build/rootfs/etc/dnf/repos.override.d/99-weblinux-security.repo)
[PASS] Fedora 45 primary GPG key present (/root/fedora-build/rootfs/usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary)
[PASS] No gpgcheck=0 or sslverify=0 overrides detected in DNF/YUM config
[PASS] Browser RPM absent: firefox
[PASS] Browser RPM absent: epiphany
[PASS] Browser RPM absent: falkon
[PASS] Browser RPM absent: chromium
[PASS] No browser binaries present in /root/fedora-build/rootfs/usr/bin
[PASS] Browser wrapper absent: /root/fedora-build/rootfs/usr/local/bin/weblinux-browser
[PASS] Browser desktop entry absent: /root/fedora-build/rootfs/usr/share/applications/weblinux-browser.desktop
[PASS] Retained tool present: /usr/bin/curl (curl-8.21.0-1.rvre0.fc45.riscv64)
[PASS] Retained tool present: /usr/bin/git (git-core-2.55.0-2.fc45.riscv64)
[PASS] Retained tool present: /usr/bin/dnf5 (dnf5-5.4.3.0-2.fc45.riscv64)
[INFO] /usr/bin/wget not present (not included in Fedora 45 Container Base; curl is retained)
=== Summary ===
ALL CHECKS PASSED: Fedora 45 KDE rootfs is browser-free with gpgcheck=1 enforced.
```
