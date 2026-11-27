# Phase 14 — OPFS Persistence (`PHASE-04-PERSISTENCE.md`)

All five testable distributions were verified across a full `window.weblinuxAdapter.shutdown()` and Playwright `page.reload()` cycle without calling `resetAll()` or `freshHomeDisk: true`.

## Persistence Verification Matrix

| Distribution | Warm Reload Boot | Persisted Profile Marker & Downloaded `example.html` | SHA-256 Integrity |
|---|---|---|---|
| **Ubuntu 24.04.5 KDE** | `65.7s` | `/home/ubuntu/.config/p14-profile-marker.txt`, `/home/ubuntu/Downloads/example.html` | **PASS** (`25ddf2c8...` & `5cff6a10...` matched) |
| **Alpine 3.24.4 KDE** | `44.8s` | `/root/browser-home/.config/p14-profile-marker.txt`, `/root/browser-home/Downloads/example.html` | **PASS** (`25ddf2c8...` & `0072b932...` matched) |
| **Debian 13 KDE** | `18.7s` | `/root/browser-home/.config/p14-profile-marker.txt`, `/root/browser-home/Downloads/example.html` | **PASS** (`25ddf2c8...` & `9bec1951...` matched) |
| **Arch Linux KDE** | `22.7s` | `/root/browser-home/.config/p14-profile-marker.txt`, `/root/browser-home/Downloads/example.html` | **PASS** (`25ddf2c8...` & `6975d41c...` matched) |
| **openSUSE Tumbleweed KDE** | `24.1s` | `/root/browser-home/.config/p14-profile-marker.txt`, `/root/browser-home/Downloads/example.html` | **PASS** (`25ddf2c8...` & `32431be9...` matched) |
