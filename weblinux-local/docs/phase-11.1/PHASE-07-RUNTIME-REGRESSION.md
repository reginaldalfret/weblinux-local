# Phase 11.1.6 — Runtime Security Regression

**Date:** 2026-11-27  
**Browser:** Microsoft Edge (`chromium.launchPersistentContext`)  
**Suite:** `tests/test-phase11-1-runtime-regression.js`  
**Result:** `REGRESSION_PASS COLD=26.0s WARM=53.8s SHA256=284ef875ac6142daaf0781f305f1aed12edc12213ccecc2e3894a95991362501`

---

## 1. Live Fedora 45 RISC-V KDE Verification

- **Cold boot:** `26.0s` (`shellReady: true`, `waylandActive: true`).
- **Mounts & Filesystem:** `/dev/wda on /fedora` (`UUID=14dca0d4-ba28-4de2-86df-ae7c470fa7bc`), `/dev/wdb on /fedora/root` (`UUID=cb3bea2a-b092-4de5-ad57-b78aeb0ac313`). Zero `EXT4-fs error` entries.
- **Imported GPG Key (`rpm -q gpg-pubkey`):** `gpg-pubkey-4f50a6114cd5c6976a7f1179655a4b02f577861e-6888bc98`
- **Repositories (`dnf5 repolist --all`):** `fedora` (`enabled`); `fedora-staging`, `fedora-koji`, `*-debuginfo`, `*-source` (`disabled`).
- **Effective Policy (`dnf5 repo info fedora`):** `Verify packages : true`, `Skip if unavailable : false`, `Keys : file:///usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary`, `Verify repodata : false`.
- **Integrity & Dry-run (`dnf5 check` & `dnf5 upgrade --refresh --assumeno`):** `dnf5 check` exited `0`; dry-run proposed only the 3 unsigned `fedora-release-*` packages (`0:45-13`) and aborted without modifying the disk.
- **Networking & RFC1918 Isolation:**
  - `getent hosts example.com` resolved; `curl -sI https://example.com` returned `HTTP/2 200`.
  - `curl -s --max-time 4 http://192.168.1.1` blocked (`RFC1918_BLOCKED_OK`).
- **Plasma 6.7.4 Desktop & Apps:** Desktop panel, Kickoff launcher, Konsole, and Dolphin all rendered cleanly (`tests/screenshots/phase11-1/p11-1-01-desktop.png`, `p11-1-02-konsole.png`, `p11-1-03-dolphin.png`).
- **OPFS Persistence (`root-fedora-kde` / `home-fedora-kde`):**
  - Warm reboot (`53.8s`) and `page.reload()` both preserved `/root/p11-1-persist.dat` (`SHA-256: 284ef875ac6142daaf0781f305f1aed12edc12213ccecc2e3894a95991362501`) and `/root/p11-1-reload.txt` (`RELOAD_OK_11_1`) with zero `EXT4-fs error` entries.

---

## 2. Build, Typecheck & Cross-Distribution Regression

- `apps/web`: `npx tsc --noEmit` exited `0`; `npm run build` exited `0`.
- `tests/test-phase8-networking.js`: exited `0` (verified Ubuntu Noble Numbat KDE + Debian 13 Trixie boot, DNS `172.66.147.243`, `HTTPS_STATUS: 200 TITLE_OK: True`, `RFC1918_BLOCK: OK URLError`).
- `git diff --stat 28d4d99..HEAD -- apps/web/public/manifests/`: confirmed only `fedora-kde.json` changed; Debian, Ubuntu, Arch, and openSUSE manifests, OPFS disk IDs, and runtime profiles remain completely untouched.
