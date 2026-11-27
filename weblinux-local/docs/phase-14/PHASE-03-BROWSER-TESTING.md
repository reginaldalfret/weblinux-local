# Phase 14 — Live Browser Testing (`PHASE-03-BROWSER-TESTING.md`)

Live qualification was executed in Microsoft Edge via `tests/test-phase14-browser.js <distroId>` against the running Vite dev server (`http://localhost:3000`) and Guest Network Relay (`ws://127.0.0.1:8081`).

## Test Results Matrix

| Distribution | Cold Boot | Binary & Version | Network (`https://example.com` + RFC1918 block) | Live Browser Launch Under `/bin/rv` |
|---|---|---|---|---|
| **Ubuntu 24.04.5 KDE** (`ubuntu-kde-epiphany`) | `22.8s` | `/usr/bin/epiphany` (`Web 46.5`) | `HTTP/2 200`, `RFC1918_BLOCKED_OK` | **PASS** — `epiphany` (PID 339) + `WebKitNetworkProcess` (PID 357) running; Mem used `1127/2009 MiB` |
| **Alpine 3.24.4 KDE** (`alpine-kde`) | `25.1s` | `/usr/bin/epiphany` (`Web 50.4`, `ld-musl-riscv64.so.1` ELF64) | `HTTP/2 200`, `RFC1918_BLOCKED_OK` | **RUNTIME ISSUE** — Wrapper failed with `sh: %q : invalid format` (busybox ash lacks `%q`) and `libportal-CRITICAL: Failed to create XdpPortal instance`; Mem used `1177/2009 MiB` |
| **Debian 13 KDE** (`debian-firefox`) | `26.9s` | `/usr/bin/epiphany` (`Web 48.5`, RISC-V ELF64) | `HTTP/2 200`, `RFC1918_BLOCKED_OK` | **RUNTIME ISSUE** — Wrapper hit `su: Authentication failure` in chroot; Mem used `1371/2009 MiB` |
| **Arch Linux KDE** (`arch-kde`) | `29.1s` | `/usr/bin/chromium` (`157.0.8103.78-1`, RISC-V ELF64) | `HTTP/2 200`, `RFC1918_BLOCKED_OK` | **RUNTIME ISSUE** — Missing shared library `libsimdutf.so.36: cannot open shared object file` (snapshot/soname mismatch) |
| **openSUSE Tumbleweed KDE** (`opensuse-tumbleweed-kde`) | `21.6s` | `/usr/bin/chromium` (`Chromium 155.0.8059.84 stable`) | `HTTP/2 200`, `RFC1918_BLOCKED_OK` | **RUNTIME ISSUE** — Crashpad/fork NOMMU failure (`rv: cannot copy the guest from the parent of a fork`, `FATAL:path_service.cc:264`, `rv: illegal instruction 0x00000000 at pc 0x5d01722`) |
| **Fedora 45 KDE** (`fedora-kde`) | — | — | — | **BLOCKED** — Unsigned `riscv-koji` RPMs (`gpgcheck=1` preserved) |

## Artifacts
Screenshots and JSON test outputs are stored in `tests/screenshots/phase14/`:
- `p14-ubuntu-kde-epiphany-example.png`, `p14-ubuntu-kde-epiphany-persisted.png`, `p14-ubuntu-kde-epiphany-result.json`
- `p14-alpine-kde-example.png`, `p14-alpine-kde-persisted.png`, `p14-alpine-kde-result.json`
- `p14-debian-firefox-example.png`, `p14-debian-firefox-persisted.png`, `p14-debian-firefox-result.json`
- `p14-arch-kde-example.png`, `p14-arch-kde-persisted.png`, `p14-arch-kde-result.json`
- `p14-opensuse-tumbleweed-kde-example.png`, `p14-opensuse-tumbleweed-kde-persisted.png`, `p14-opensuse-tumbleweed-kde-result.json`
