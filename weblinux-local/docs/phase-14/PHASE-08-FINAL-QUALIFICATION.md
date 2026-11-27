# Phase 14 — Final Native Browser Qualification Report

**Date:** 2026-11-27  
**Branch:** `feature/runtime-foundations`

| Distribution | Best Native Candidate | Version (`riscv64`) | Status |
|---|---|---|---|
| Debian 13 KDE | `epiphany-browser` | `48.5-0+deb13u1` | **BLOCKED — SANDBOX UNAVAILABLE** |
| Ubuntu 24.04.5 KDE | `epiphany-browser` | `46.0-2build1` | **BLOCKED — SANDBOX UNAVAILABLE** |
| Arch Linux KDE | `chromium` | `157.0.8103.78-1` | **BLOCKED — SANDBOX UNAVAILABLE** |
| openSUSE Tumbleweed KDE | `chromium` | `155.0.8059.84-238.1` | **BLOCKED — SANDBOX UNAVAILABLE** |
| Fedora 45 KDE | `firefox` / `epiphany` / `falkon` | `154.0` / `51~beta` / `26.08.0` | **BLOCKED** (unsigned Koji RPMs + sandbox unavailable) |
| Alpine 3.24.4 KDE | `epiphany` | `50.4-r0` | **BLOCKED — SANDBOX UNAVAILABLE** |

All six existing KDE Plasma 6 environments and their persistent OPFS disks remain intact and unmodified.
