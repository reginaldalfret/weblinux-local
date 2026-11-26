# Phase 11.1.5 — Fedora Security Update Qualification

**Date:** 2026-11-27  
**Command:** `dnf5 --installroot="$R" --forcearch=riscv64 --releasever=45 upgrade --refresh --assumeno`

---

## 1. Dry-Run Transaction Inspection

With only the hardened `[fedora]` repository enabled (`gpgcheck=1`, `sslverify=1`, `skip_if_unavailable=0`), the dry-run upgrade proposed **3** packages:

| Package | Arch | Installed | Proposed | Repository |
|---|---|---|---|---|
| `fedora-release-common` | `noarch` | `0:45-0.10` | `0:45-13` | `fedora` |
| `fedora-release-container` | `noarch` | `0:45-0.10` | `0:45-13` | `fedora` |
| `fedora-release-identity-container` | `noarch` | `0:45-0.10` | `0:45-13` | `fedora` |

- No `glibc`, `rpm`, `dnf5`, `qt6-qtbase`, `mesa-dri-drivers`, `plasma-workspace`, `kwin`, `dolphin`, or `konsole` updates were pending.
- Total download size: `43 KiB`.

---

## 2. Signature Gate & Production Decision

Inspection of `fedora-release-common-0:45-13.noarch.rpm` from `https://riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/` via `rpm -Kv` showed:
- `Header SHA256 digest: OK`
- `Payload SHA256 digest: OK`
- `Header OpenPGP signature: NOTFOUND`

Per Phase 11.1 policy (*"Do not turn off signature checking just to make installation succeed. Do not apply unsigned packages to the existing persistent production Fedora disk"*):
- The 3 unsigned `fedora-release-*` packages were **not** applied to the persistent production disk.
- The existing `717`-package lock (`docs/phase-11/fedora-kde-packages.lock`) remains unchanged and valid.
- Repackaged rootfs image (`e2fsck -fy` clean: `94441/212992` files, `527130/851968` blocks) produced `3328` chunks (`1969` non-zero, `sha256=852661e6fa2fbdec4b0e41a75daaf272a994bc3cb948cea63e7606406fe6a754`, `RECONSTRUCT_OK=True`).
