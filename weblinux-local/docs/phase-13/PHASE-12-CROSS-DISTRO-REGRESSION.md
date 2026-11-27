# Phase 13.12 — Cross-Distribution Regression

**Date:** 2026-11-27

- **Manifest isolation (`git diff --stat 13d692e..HEAD -- apps/web/public/manifests/`):** Added `alpine-kde.json` and synchronized the shared `initrdSha256` (`e5081a47223a8003e637039e9a3546a1220a1d6f246f665ac5df2e437c60e96c`) and `initrdSize` (`15064075`) across the 9 active manifests sharing `initramfs-wasm64_nommu.cpio.gz` (`ubuntu.json`, `ubuntu-kde.json`, `ubuntu-kde-epiphany.json`, `ubuntu-gnome.json`, `debian.json`, `debian-firefox.json`, `arch-kde.json`, `opensuse-tumbleweed-kde.json`, `fedora-kde.json`). All disk identities and rootfs chunks remain untouched.
- **TypeScript & Production Build (`apps/web`):** `npx tsc --noEmit` (`exit 0`), `npm run build` (`exit 0`).
- **Networking & Multi-Distro Regression (`tests/test-phase8-networking.js`):** Passed (`exit 0`, verified Ubuntu Noble Numbat KDE + Debian 13 Trixie boot, DNS, HTTPS `200`, and RFC1918 block).
