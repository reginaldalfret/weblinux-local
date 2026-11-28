# Phase 15 — Baseline & Browser Removal Plan (`PHASE-00-BASELINE.md`)

## Verified Starting Git Baseline
- **Repository:** `https://github.com/reginaldalfret/weblinux-local`
- **Branch:** `feature/runtime-foundations`
- **HEAD / Remote HEAD:** `be81a42d9576003e7d295b6eac45651ffc62b031`

## Phase 15 Policy
- **Goal:** Remove all project-added graphical web browsers, `/usr/local/bin/weblinux-browser` wrappers, and `/usr/share/applications/weblinux-browser.desktop` entries from all six distributions.
- **Preservation:** Retain terminal networking (`curl`, `wget`, `git`, DNS, TLS, `ws://127.0.0.1:8081`, RFC1918 blocking), native package managers (`apt`, `pacman`, `zypper`, `dnf5`, `apk`) with full signature verification, shared GTK/WebKit/Qt desktop libraries, KDE Plasma desktops, and all existing user files/OPFS home disks.
- **Historical Traceability:** Phase 8 and Phase 14/14.1/14.2 reports remain in Git and are marked superseded by Phase 15's browser-free policy.

## Parallel Agent Assignments
1. **Agent 1 (Debian 13 KDE):** `scripts/cleanup-debian-browser.sh`, `docs/phase-15/PHASE-01-DEBIAN-CLEANUP.md`
2. **Agent 2 (Ubuntu 24.04.5 KDE):** `scripts/cleanup-ubuntu-browser.sh`, `docs/phase-15/PHASE-02-UBUNTU-CLEANUP.md`
3. **Agent 3 (Arch Linux KDE):** `scripts/cleanup-arch-browser.sh`, `docs/phase-15/PHASE-03-ARCH-CLEANUP.md`
4. **Agent 4 (openSUSE Tumbleweed KDE):** `scripts/cleanup-opensuse-browser.sh`, `docs/phase-15/PHASE-04-OPENSUSE-CLEANUP.md`
5. **Agent 5 (Fedora 45 KDE):** `scripts/verify-fedora-no-browser.sh`, `docs/phase-15/PHASE-05-FEDORA-CLEANUP.md`
6. **Agent 6 (Alpine 3.24.4 KDE):** `scripts/cleanup-alpine-browser.sh`, `docs/phase-15/PHASE-06-ALPINE-CLEANUP.md`
7. **Agent 7 (Integration & QA):** `tests/test-phase15-browser-removal.js`, `docs/phase-15/PHASE-07-REGRESSION.md`
