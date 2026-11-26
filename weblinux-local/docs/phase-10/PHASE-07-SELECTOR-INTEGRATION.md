# Phase 10 — Distribution Selector & Runtime Integration

## 1. Integrated Files

- **Manifest:** `apps/web/public/manifests/opensuse-tumbleweed-kde.json` (`id: "opensuse-tumbleweed-kde"`, `packageManager: "zypper"`, `validationStatus: "experimental"`)
- **Types:** `runtime/types.ts` (added `'opensuse-tumbleweed-kde'` to `DistributionId` & `DesktopEnvironmentId`, `'zypper'` to `packageManager`)
- **Desktop Profile:** `runtime/profiles/desktopProfiles.ts` (`opensuse-tumbleweed-kde`)
- **Runtime Adapter:** `runtime/adapters/WasmLinuxAdapter.ts` (isolated `root-opensuse-tumbleweed-kde` & `home-opensuse-tumbleweed-kde`, `opensuse-kde /usr/local/bin/opensuse-kde-session`, clean `/opensuse/root` unmount on `shutdown()`)
- **UI Pages:** `apps/web/src/App.tsx`, `apps/web/src/pages/DistributionSelector.tsx`, `apps/web/src/pages/DesktopSelector.tsx`

All existing distributions (`debian`, `debian-firefox`, `ubuntu`, `ubuntu-gnome`, `ubuntu-kde-epiphany`, `arch-kde`) and their OPFS disk identities remain untouched.
