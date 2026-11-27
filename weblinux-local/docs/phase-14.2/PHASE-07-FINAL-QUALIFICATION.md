# Phase 14.2 — Final Qualification (`PHASE-07-FINAL-QUALIFICATION.md`)

## Multi-Agent Execution Summary
Six specialist subagents executed in parallel across all six distributions and the shared QA framework:
- **Agent 1 (Debian 13):** `scripts/install-debian-browser.sh`, `docs/phase-14.2/PHASE-01-DEBIAN.md`
- **Agent 2 (Alpine 3.24.4):** `scripts/install-alpine-browser.sh`, `docs/phase-14.2/PHASE-02-ALPINE.md`
- **Agent 3 (Arch Linux):** `scripts/install-arch-browser.sh`, `docs/phase-14.2/PHASE-03-ARCH.md`
- **Agent 4 (openSUSE Tumbleweed):** `scripts/install-opensuse-browser.sh`, `docs/phase-14.2/PHASE-04-OPENSUSE.md`
- **Agent 5 (Fedora 45):** `scripts/install-fedora-browser.sh`, `docs/phase-14.2/PHASE-05-FEDORA.md`
- **Agent 6 (Browser QA):** `tests/test-phase14-browser.js`, `docs/phase-14.2/PHASE-06-BROWSER-TESTING.md`

## Final Qualification Matrix

| Distribution | Status | Browser & Version | Package Origin & Signature | Boot / Reload | Live Browser & Persistence Findings |
|---|---|---|---|---|---|
| **Ubuntu 24.04.5 KDE** (`ubuntu-kde-epiphany`) | **PASS** | Epiphany `Web 46.5` | `apt` Ubuntu Noble `riscv64` (signed) | `34.4s` / `57s` | `epiphany` (PID `346`) running on Plasma 5.27; `HTTP/2 200`, `RFC1918_BLOCKED_OK`, download SHA-256 & bookmark/profile OPFS persistence verified (`task-10374`). |
| **openSUSE Tumbleweed KDE** (`opensuse-tumbleweed-kde`) | **PASS WITH LIMITATION** | Epiphany `Web 51.2` | `openSUSE-Tumbleweed-Oss` `epiphany-51.2-1.1.riscv64` (GPG-signed) | `33.6s` / `39.3s` | `epiphany` (PID `441`) + `WebKitNetworkProcess` (PID `530`) running as `browser` (`uid=1000`); Plasma 6 desktop rendered (`p14-opensuse-tumbleweed-kde-local.png`); `HTTP/2 200`, `RFC1918_BLOCKED_OK`, OPFS persistence verified (`task-10327`). |
| **Debian 13 KDE** (`debian-firefox`) | **PASS WITH LIMITATION** | Epiphany `Web 48.5` (+ `netsurf-gtk 3.11-2`) | `deb.debian.org/debian` `trixie/main` `riscv64` (signed) | `43.4s` / `24.2s` | `setpriv` resolved `su` failure; `HTTP/2 200`, `RFC1918_BLOCKED_OK`, OPFS persistence verified (`task-10368`). Under 2048 MiB NOMMU pressure after Plasma 6 (`used 1374/2009 MiB`), `epiphany` hit `libjavascriptcoregtk-6.0.so.1: failed to map segment` and `netsurf-gtk` hit `libldap.so.2: failed to map segment`. |
| **Alpine 3.24.4 KDE** (`alpine-kde`) | **PASS WITH LIMITATION** | Epiphany `Web 50.4` (+ `badwolf 1.4.0-r0`) | `dl-cdn.alpinelinux.org/alpine/v3.24` `riscv64` (RSA-signed) | `23.8s` / `36.4s` | Installed `badwolf 1.4.0-r0` + `gvfs 1.60.1-r0` (`e2fsck -fy` clean, `b6705199c468a91cc5abf44a03928c52`). In `task-10290`, `epiphany 50.4` hit `Segmentation fault` on musl/NOMMU (`HTTP/2 200`, `RFC1918_BLOCKED_OK` passed). |
| **Arch Linux KDE** (`arch-kde`) | **BLOCKED** | Epiphany `51.2-1` (replaced `chromium 157.0.8103.78-1`) | Arch `extra` `riscv64` (PGP-signed) | `25.2s` / `29s` | Installed `epiphany 51.2-1` + `webkitgtk-6.0 2.54.2-1` via `pacman -Syu` (`c753a4f41ccf15538b9b79a94163df93`). Upstream `extra` repo has `libjxl.so.0.12` SONAME mismatch (`epiphany: error while loading shared libraries: libjxl.so.0.12`); `HTTP/2 200`, `RFC1918_BLOCKED_OK`, OPFS persistence passed (`task-10394`). |
| **Fedora 45 KDE** (`fedora-kde`) | **BLOCKED** | None | `dl.fedoraproject.org` `404`; `riscv-koji` unsigned | — | `gpgcheck=1` preserved; `rpm -Kv` confirmed `Header OpenPGP signature: NOTFOUND` on `riscv-koji` RPMs. |

> [!NOTE]
> All browser configurations use experimental unsandboxed execution (`WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`, `JSC_useJIT=0`, `JSC_useWebAssembly=0`), preserve TLS certificate verification, and enforce RFC1918 private-network blocking on `ws://127.0.0.1:8081`.
