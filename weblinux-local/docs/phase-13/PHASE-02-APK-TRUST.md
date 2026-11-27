# Phase 13.2 — APK Repository Trust & Signature Verification

**Date:** 2026-11-27  
**Target:** Alpine Linux `3.24.4` (`v3.24/main`, `v3.24/community`, `riscv64`)

---

## 1. Repository & Key Configuration

- **`/etc/apk/repositories`:**
  ```
  https://dl-cdn.alpinelinux.org/alpine/v3.24/main
  https://dl-cdn.alpinelinux.org/alpine/v3.24/community
  ```
  (No Edge, testing, or third-party repositories enabled.)
- **Installed Trusted Keys (`/etc/apk/keys/` from `alpine-keys-2.6-r0`):**
  - `alpine-devel@lists.alpinelinux.org-60ac2099.rsa.pub`
  - `alpine-devel@lists.alpinelinux.org-616db30d.rsa.pub`
- **Trust Separation:** Rootfs release authenticity uses Natanael Copa's OpenPGP key (`0482 D840 22F5 2DF1 C4E7 CD43 293A CD09 07D9 495A`), whereas APK indexes and `.apk` packages use the RSA signing keys in `/etc/apk/keys/`.

---

## 2. Verification & Negative Signature Results

- `apk --version`: `apk-tools 3.0.9-r0, compiled for riscv64.`
- `apk update`: `OK: 26791 distinct packages available` (`v3.24/main` + `v3.24/community`).
- `apk policy alpine-keys`: `2.6-r0` (`https://dl-cdn.alpinelinux.org/alpine/v3.24/main`).
- **Valid signed package (`apk verify` + `apk add --no-cache tzdata`):** `/tmp/tzdata-2026f-r0.apk: OK`, installed cleanly (`17 packages`).
- **Tampered APK (`apk add --force-non-repository /tmp/tampered.apk`):** Rejected (`ERROR: tzdata-2026f-r0: file format is invalid or inconsistent`).
- **Untrusted key (`apk --keys-dir /tmp/emptykeys verify`):** Rejected (`/tmp/tzdata-2026f-r0.apk: UNTRUSTED signature`).
