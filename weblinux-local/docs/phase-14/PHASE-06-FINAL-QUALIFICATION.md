# Phase 14 — Final Qualification Summary (`PHASE-06-FINAL-QUALIFICATION.md`)

## Executive Summary
Phase 14 Simple Native Browser Installation installed signed native RISC-V browsers into **Alpine 3.24.4 KDE** (`epiphany 50.4-r0`), **openSUSE Tumbleweed KDE** (`chromium 155.0.8059.84`), **Arch Linux KDE** (`chromium 157.0.8103.78-1`), and **Debian 13 KDE** (`epiphany-browser 48.5-0+deb13u1`), retained pre-installed **Ubuntu 24.04.5 KDE** (`epiphany-browser 46.5`), and preserved **Fedora 45 KDE**'s `gpgcheck=1` security posture by reporting unsigned `riscv-koji` browser RPMs as **BLOCKED**.

## Security & Sandbox Disclosure
- **Unsandboxed execution:** All installed browser wrappers explicitly use unsandboxed flags (`WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` for Epiphany/WebKitGTK; `--no-sandbox` for Chromium) as accepted by the Phase 14 specification.
- **Network & TLS:** Guest TLS certificate validation remains active (`HTTP/2 200` on `https://example.com`), and host relay RFC1918 private-network blocking (`RFC1918_BLOCKED_OK`) passed across all 5 booted distributions.
- **Fedora 45:** `gpgcheck=1` was **not** weakened; unsigned `riscv-koji` packages were not installed.

## Qualification Matrix

| Distribution | Package Installed | Live Browser Launch Under `/bin/rv` | Persistence & Network |
|---|---|---|---|
| **Ubuntu 24.04.5 KDE** | `epiphany-browser` (`Web 46.5`) | **PASS** (`epiphany` + `WebKitNetworkProcess` running) | **PASS** |
| **Alpine 3.24.4 KDE** | `epiphany 50.4-r0` | **RUNTIME ISSUE** (`sh: %q : invalid format` in busybox ash wrapper; `libportal-CRITICAL`) | **PASS** |
| **Debian 13 KDE** | `epiphany-browser 48.5-0+deb13u1` | **RUNTIME ISSUE** (`su: Authentication failure` in chroot wrapper) | **PASS** |
| **Arch Linux KDE** | `chromium 157.0.8103.78-1` | **RUNTIME ISSUE** (`libsimdutf.so.36: cannot open shared object file`) | **PASS** |
| **openSUSE Tumbleweed KDE** | `chromium 155.0.8059.84-238.1` | **RUNTIME ISSUE** (NOMMU `fork`/crashpad failure & `FATAL:path_service.cc:264`) | **PASS** |
| **Fedora 45 KDE** | **BLOCKED** (unsigned `riscv-koji` RPMs) | **BLOCKED** | N/A |
