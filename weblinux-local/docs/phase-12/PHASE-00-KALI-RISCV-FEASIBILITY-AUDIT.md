# Phase 12 — Kali Linux RISC-V (`riscv64`) Feasibility & Provenance Audit

**Date:** 2026-11-27  
**Branch:** `feature/runtime-foundations`  
**Starting Verified HEAD:** `465c461c1685c65a054057e0487bae067fcfc10b`  
**Feasibility Gate Result:** **BLOCKED — Official & Native `riscv64` Kali Linux Distribution Unavailable**

---

## 1. Executive Decision

Per Phase 12 execution rules:
- *"Do not substitute a renamed Debian installation for Kali."*
- *"Do not create or expose the Kali profile until package provenance and architecture feasibility are established."*
- *"If the Kali RISC-V feasibility gate fails, document the exact blocker and preserve the existing five-distribution lineup."*

Because Kali Linux provides **no native `riscv64` architecture, no `binary-riscv64` APT indices, and no `riscv64` release images**, the Phase 12 feasibility gate **fails**. No `kali-kde` disk, initramfs entry, or UI profile was created, and the existing five-distribution WebLinux lineup (Debian 13, Ubuntu 24.04.5, Arch Linux, openSUSE Tumbleweed, Fedora 45) is preserved untouched.

---

## 2. Official Kali Archive & Signature Verification

| Check | Target | Result |
|---|---|---|
| Signing Key | `https://archive.kali.org/archive-key.asc` | `rsa4096` `2025-04-17` (expires `2028-04-17`), Fingerprint `827C 8569 F251 8CC6 77FE CA1A ED65 462E C8D5 E4C5` (`Kali Linux Archive Automatic Signing Key (2025) <devel@kali.org>`) |
| `InRelease` / `Release.gpg` | `https://http.kali.org/kali/dists/kali-rolling/` | **Good signature** (`Date: Fri, 27 Nov 2026 00:24:55 UTC`) |
| `kali-rolling` Architectures | `Release` metadata | `Architectures: i386 amd64 armhf arm64` |
| `kali-dev` Architectures | `https://http.kali.org/kali/dists/kali-dev/Release` | `Architectures: i386 amd64 armhf arm64` |
| `kali-experimental` Architectures | `https://http.kali.org/kali/dists/kali-experimental/Release` | `Architectures: i386 amd64 armhf arm64` |
| `binary-riscv64` indices | `main`, `contrib`, `non-free`, `non-free-firmware` (`Packages.xz`, `Packages.gz`, `Release`) | **All 12 URLs returned `HTTP 404`** |
| Kali Weekly / Current Images | `https://cdimage.kali.org/kali-weekly/`, `https://cdimage.kali.org/current/` | Zero `riscv64` images |

---

## 3. Package Architecture & Dependency Closure Analysis

Parsed `https://http.kali.org/kali/dists/kali-rolling/main/binary-amd64/Packages.gz` (`71,943` entries: `37,106` arch-specific, `34,837` `Architecture: all`):

- **Base & Desktop Metapackages (Arch-specific, unavailable for `riscv64`):**
  - `base-files` (`1:2026.3.1`, `arch=amd64`)
  - `kali-linux-core` (`2026.4.4`, `arch=amd64`)
  - `kali-desktop-kde` (`2026.4.4`, `arch=amd64`, depends on `konsole`, `kali-desktop-core`, `plasma-desktop`, `kwin-style-kali`, `kwin-x11`, `plasma-nm`, `sddm`, `dolphin`, etc.)
- **Core Compiled Security Tools (Arch-specific, unavailable for `riscv64`):**
  - `nmap` (`7.991+dfsg-1kali1`), `john` (`1.9.0-Jumbo-1+git20261011-0kali1`), `metasploit-framework` (`6.5.9-0kali1`), `wireshark` (`4.6.9-1+b1`), `aircrack-ng`, `hydra`, `gobuster`, `ffuf`
- **`Architecture: all` Only:**
  - `kali-archive-keyring` (`2025.3`), `kali-defaults` (`2026.4.2`), `kali-themes` (`2026.4.3`), `sqlmap` (`1.10.11-1`).

---

## 4. Blocker Summary

1. **No upstream `riscv64` port:** Official Kali Rolling (`kali-rolling`), `kali-dev`, and `kali-experimental` support only `i386`, `amd64`, `armhf`, and `arm64`.
2. **No authentic binary closure:** Installing `kali-themes` / `kali-defaults` onto Debian 13 RISC-V would produce a renamed Debian userspace rather than an authentic Kali Linux distribution.
3. **Preserved state:** Existing `D:\weblinux-disks\` directories (`debian-13-firefox`, `ubuntu-24.04-kde-epiphany`, `arch-kde`, `opensuse-tumbleweed-kde`, `fedora-kde`) and all runtime/UI manifests remain untouched.
