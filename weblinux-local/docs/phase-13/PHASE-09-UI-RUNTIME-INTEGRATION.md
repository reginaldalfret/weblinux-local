# Phase 13.9 — WebLinux UI & Runtime Integration

**Date:** 2026-11-27  
**Manifest:** `apps/web/public/manifests/alpine-kde.json`

---

## 1. Integrated Files

- `apps/web/public/manifests/alpine-kde.json`: Profile `alpine-kde` (`Alpine Linux`, `3.24.4`, `riscv64`, `packageManager: "apk"`, `rootMount: "/alpine"`, `homeMount: "/home/root"`, `fullImageSha256: 5067754980014f1250493043183e96decbddcdc41c993dff481091ff82bbbfa1`, `initrdSha256: e5081a47223a8003e637039e9a3546a1220a1d6f246f665ac5df2e437c60e96c`, `minMemoryMB: 2048`).
- `runtime/types.ts`: Added `'alpine-kde'` to `DistributionId` and `DesktopEnvironmentId`.
- `runtime/profiles/desktopProfiles.ts`: Added `alpine-kde` profile (`Alpine Linux KDE Plasma 6`, `6.6.6`, `alpine-kde /usr/local/bin/alpine-kde-session`, `root-alpine-kde` + `home-alpine-kde`).
- `runtime/adapters/WasmLinuxAdapter.ts`: Wired `/disk/alpine-kde/`, `root-alpine-kde`, `home-alpine-kde`, and `alpine-kde /usr/local/bin/alpine-kde-session`.
- `apps/web/src/App.tsx`, `apps/web/src/pages/DistributionSelector.tsx`, `apps/web/src/pages/DesktopSelector.tsx`: Added `alpine-kde` card (`🏔️`), selection, and launch routing while preserving all 5 existing distributions.
