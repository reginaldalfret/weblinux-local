# Phase 14.2 — Baseline & Parallel Orchestration (`PHASE-00-BASELINE.md`)

## Verified Starting Git Baseline
- **Repository:** `https://github.com/reginaldalfret/weblinux-local`
- **Branch:** `feature/runtime-foundations`
- **HEAD / Remote HEAD:** `f3238566c6d5691f19210b03b54efe65e448d860`

## Pre-Phase 14.2 Browser Inventory
| Distribution | Manifest ID | Browser | Pre-14.2 Status |
|---|---|---|---|
| **Ubuntu 24.04.5 KDE** | `ubuntu-kde-epiphany` | Epiphany `Web 46.5` | **PASS** (regression baseline) |
| **openSUSE Tumbleweed KDE** | `opensuse-tumbleweed-kde` | Epiphany `Web 51.2` | **PASS WITH LIMITATION** (running, screenshot captured pre-paint) |
| **Alpine 3.24.4 KDE** | `alpine-kde` | Epiphany `Web 50.4` | **PASS WITH LIMITATION** (exited before `ps`) |
| **Debian 13 KDE** | `debian-firefox` | Epiphany `Web 48.5` | **PASS WITH LIMITATION** (`libz.so.1: failed to map segment` after Plasma 6) |
| **Arch Linux KDE** | `arch-kde` | Chromium `157.0.8103.78-1` | **BLOCKED** (`libsimdutf.so.36` vs `simdutf 9.3.2-1` `libsimdutf.so.37`) |
| **Fedora 45 KDE** | `fedora-kde` | None | **BLOCKED** (`gpgcheck=1`, unsigned `riscv-koji` RPMs) |

## Parallel Specialist Assignments
- **Agent 1 (Debian 13):** `scripts/install-debian-browser.sh`, `docs/phase-14.2/PHASE-01-DEBIAN.md`
- **Agent 2 (Alpine 3.24.4):** `scripts/install-alpine-browser.sh`, `docs/phase-14.2/PHASE-02-ALPINE.md`
- **Agent 3 (Arch Linux):** `scripts/install-arch-browser.sh`, `docs/phase-14.2/PHASE-03-ARCH.md`
- **Agent 4 (openSUSE Tumbleweed):** `scripts/install-opensuse-browser.sh`, `docs/phase-14.2/PHASE-04-OPENSUSE.md`
- **Agent 5 (Fedora 45):** `scripts/install-fedora-browser.sh`, `docs/phase-14.2/PHASE-05-FEDORA.md`
- **Agent 6 (Browser QA):** `tests/test-phase14-browser.js`, `docs/phase-14.2/PHASE-06-BROWSER-TESTING.md`
