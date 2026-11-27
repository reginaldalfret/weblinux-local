# Phase 14.1 / 14.2 — Native Browser Package Feasibility Matrix

**Date:** 2026-11-27  
**Preference Order:** Chromium -> Firefox -> Epiphany -> Falkon

| Distribution | Best Native Candidate(s) | Version (`riscv64`) | Origin / Signature | Build Needed? | Runtime / Security Status |
|---|---|---|---|---|---|
| **Debian 13 KDE** | `epiphany-browser` (`firefox-esr` also present) | `48.5-0+deb13u1` (`firefox-esr 153.5.1esr-1~deb13u1`) | Debian Trixie APT (signed) | No | **BLOCKED — SANDBOX UNAVAILABLE** (`bwrap: Failed to make / slave: Function not implemented`; `firefox-esr` `order 16` `mmap` + `fork()` blocked) |
| **Ubuntu 24.04.5 KDE** | `epiphany-browser` | `46.0-2build1` | Ubuntu Noble APT (signed) | No | **BLOCKED — SANDBOX UNAVAILABLE** (`bwrap: Failed to make / slave: Function not implemented`, `unshare -U`: `EPERM`) |
| **Arch Linux KDE** | `chromium` | `157.0.8103.78-1` | Arch RISC-V `extra.db` (`.sig`) | No | **BLOCKED — SANDBOX UNAVAILABLE** (installed cleanly in disposable staging, but `CONFIG_SECCOMP` absent & `CLONE_NEWUSER` `EPERM`) |
| **openSUSE Tumbleweed KDE** | `chromium` (`MozillaFirefox`, `epiphany`, `falkon` also present) | `155.0.8059.84-238.1` | openSUSE Ports TW OSS (RPM GPG) | No | **BLOCKED — SANDBOX UNAVAILABLE** (`CONFIG_SECCOMP` absent & `CLONE_NEWUSER` `EPERM`; Chromium lags 3 milestones) |
| **Fedora 45 KDE** | `firefox` / `epiphany` / `falkon` (no `chromium`) | `154.0-5.fc45` / `51~beta-1.fc45` / `26.08.0-1.fc45` | `riscv-koji` (**unsigned**) | Yes (or signed repo) | **BLOCKED** (upstream RPMs unsigned with `gpgcheck=1` enforced + sandbox unavailable) |
| **Alpine 3.24.4 KDE** | `epiphany` (`webkit2gtk-6.0`) | `50.4-r0` (`2.48.1-r4`) | Alpine `v3.24/community` (RSA signed) | No | **BLOCKED — SANDBOX UNAVAILABLE** (`bwrap` requires `CLONE_NEWUSER` + `MS_SLAVE` mount) |
