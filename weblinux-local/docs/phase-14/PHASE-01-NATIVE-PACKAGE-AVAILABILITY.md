# Phase 14 — Native Package Availability (`PHASE-01-NATIVE-PACKAGE-AVAILABILITY.md`)

## Repository & Package Verification Summary

| Distribution | Package Manager | Preferred Choice | Available Native Package | Signature / Provenance Status |
|---|---|---|---|---|
| **Debian 13 (Trixie)** | `apt` | Epiphany | `epiphany-browser 48.5-0+deb13u1` + `libwebkitgtk-6.0-4 2.52.6-1~deb13u1` | Signed (`apt` repository verification) |
| **Ubuntu 24.04.5 LTS** | `apt` | Epiphany | `epiphany-browser` (`Web 46.5`, pre-installed) | Signed (`apt` repository verification) |
| **Arch Linux** | `pacman` | Chromium | `chromium 157.0.8103.78-1` (20 packages) | Signed (`pacman` package signature) |
| **openSUSE Tumbleweed** | `zypper` | Chromium | `chromium-155.0.8059.84-238.1.riscv64` (+ `libc++1`, `libc++abi1`) | GPG-verified (`zypper`) |
| **Fedora 45** | `dnf5` / `rpm` | Firefox or Epiphany | `firefox-154.0-5.fc45`, `epiphany-51~beta-1.fc45`, `falkon-26.08.0-1.fc45` (`riscv-koji`) | **BLOCKED** — `riscv-koji` RPMs are unsigned; `gpgcheck=1` preserved per security policy |
| **Alpine Linux 3.24.4** | `apk` | Epiphany | `epiphany 50.4-r0` + `webkit2gtk-6.0 2.48.1-r4` | Signed (`apk` RSA key verification) |

## Fedora 45 Policy Decision
Fedora 45 (`fedora-kde`) enforces `gpgcheck=1` from Phase 11.1 security hardening. Because `firefox-154.0-5.fc45`, `epiphany-51~beta-1.fc45`, and `falkon-26.08.0-1.fc45` in `riscv-koji` are unsigned, installation was **not** forced with `--nogpgcheck` and is reported honestly as `BLOCKED`.
