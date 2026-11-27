# Phase 14 — Existing Browser Audit (`PHASE-00-EXISTING-BROWSER-AUDIT.md`)

## Scope
Audit of pre-existing browser installations across all six WebLinux RISC-V 64-bit (`riscv64`) KDE Plasma distributions prior to Phase 14 Simple Native Browser Installation.

## Audit Results

| Distribution | Manifest ID | Pre-existing Browser State | Notes |
|---|---|---|---|
| **Debian 13 (Trixie)** | `debian-firefox` | Firefox ESR (`153.5.1esr`) noted in manifest; no Epiphany/Chromium wrapper | Updated in Phase 14 to add signed `epiphany-browser 48.5-0+deb13u1` + `libwebkitgtk-6.0-4 2.52.6-1~deb13u1` |
| **Ubuntu 24.04.5 LTS** | `ubuntu-kde-epiphany` | `epiphany-browser` (`Web 46.5`) already installed from Phase 8/8.1 | Retained and re-verified live in Phase 14 (`p14-ubuntu-kde-epiphany-result.json`) |
| **Arch Linux (Community Port)** | `arch-kde` | None | Added signed `chromium 157.0.8103.78-1` in Phase 14 |
| **openSUSE Tumbleweed** | `opensuse-tumbleweed-kde` | None | Added GPG-verified `chromium 155.0.8059.84-238.1.riscv64` in Phase 14 |
| **Fedora 45** | `fedora-kde` | None | `gpgcheck=1` enforced; `riscv-koji` browser RPMs unsigned -> **BLOCKED** |
| **Alpine Linux 3.24.4** | `alpine-kde` | None | Added signed `epiphany 50.4-r0` + `webkit2gtk-6.0 2.48.1-r4` in Phase 14 |

## Unprivileged User & Sandbox Policy
Per Phase 14 mission requirements:
- No browser-internal sandbox kernel modifications (no Seccomp-BPF, no user namespaces, no separate browser Wasm runtime).
- Experimental unsandboxed browser flags (`--no-sandbox` for Chromium; `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` for WebKitGTK/Epiphany) are explicitly documented.
- TLS certificate verification remains enabled, and the host WebSocket relay (`ws://127.0.0.1:8081`) retains RFC1918/private-network filtering (`RFC1918_BLOCKED_OK` verified across all 5 booted distros).
