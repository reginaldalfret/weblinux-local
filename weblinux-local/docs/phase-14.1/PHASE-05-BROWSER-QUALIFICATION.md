# Phase 14.1 — Browser Qualification & Regression (`PHASE-05-BROWSER-QUALIFICATION.md`)

## Build & TypeScript Verification (`task-10180`)
- `npx tsc --noEmit` in `apps/web`: **PASS** (exit code `0`)
- `npm run build` (`tsc && vite build`) in `apps/web`: **PASS** (`✓ 2156 modules transformed`, `✓ built in 1m 39s`)

## Per-Distribution Live Qualification (`tests/test-phase14-browser.js`)

| Distribution | Browser & Version | Boot / Reload | Live Process Status | Network (`https://example.com` + RFC1918) | OPFS Persistence |
|---|---|---|---|---|---|
| **Ubuntu 24.04.5 KDE** | Epiphany `Web 46.5` | `22.8s` / `65.7s` | **PASS** (`epiphany` + `WebKitNetworkProcess`) | `HTTP/2 200`, `RFC1918_BLOCKED_OK` | **PASS** |
| **openSUSE Tumbleweed KDE** | Epiphany `Web 51.2` | `24.6s` / `35.3s` | **PASS WITH LIMITATION** (`epiphany` + `WebKitNetworkProcess` running as `browser`; Plasma canvas still painting at capture) | `HTTP/2 200`, `RFC1918_BLOCKED_OK` | **PASS** |
| **Alpine 3.24.4 KDE** | Epiphany `Web 50.4` | `23.8s` / `36.4s` | **PASS WITH LIMITATION** (`sh: %q` & `libportal-CRITICAL` fixed; `epiphany` exited before `ps`) | `HTTP/2 200`, `RFC1918_BLOCKED_OK` | **PASS** |
| **Debian 13 KDE** | Epiphany `Web 48.5` | `33.2s` / `16.3s` | **PASS WITH LIMITATION** (`su` fixed with `setpriv`; `libz.so.1: failed to map segment` under 2048 MiB NOMMU pressure) | `HTTP/2 200`, `RFC1918_BLOCKED_OK` | **PASS** |
| **Arch Linux KDE** | Chromium `157.0.8103.78-1` | `29.1s` / `22.7s` | **BLOCKED** (upstream `extra` ships `simdutf 9.3.2-1` `libsimdutf.so.37`, while `chromium` links `libsimdutf.so.36`) | `HTTP/2 200`, `RFC1918_BLOCKED_OK` | **PASS** |
| **Fedora 45 KDE** | None | — | **BLOCKED** (unsigned `riscv-koji` RPMs; `gpgcheck=1` preserved) | — | N/A |
