# WEBLINUX LOCAL — PHASE 5.3
# MULTI-ROOTFS ARCHITECTURE & DISK RESOLUTION SPECIFICATION

**Document ID:** `PHASE5-3-ROOTFS-001`  
**Storage Engine:** OPFS (Origin Private File System) sparse block driver  
**Partition Scheme:** Dual block device (`/dev/wda` rootfs, `/dev/wdb` user home)  
**Date:** 2026-11-24  

---

## 1. Multi-Desktop Rootfs Isolation Model

To guarantee that desktop configurations never pollute each other, WebLinux Local adopts an isolated root disk identity model:

```text
Host Browser OPFS Storage Root
│
├── root-debian-kde-plasma (/dev/wda)
│   ├── /usr/lib/x86_64-linux-gnu / Qt6
│   └── /etc/xdg/kdeglobals
│
├── root-debian-gnome (/dev/wda)
│   ├── /usr/lib/riscv64-linux-gnu / Mutter
│   └── /etc/dconf/db/local
│
├── root-debian-xfce (/dev/wda)
│   ├── /usr/lib/riscv64-linux-gnu / Labwc
│   └── /etc/xdg/xfce4
│
└── home-debian (/dev/wdb — Persistent Home)
    ├── /root/Desktop
    ├── /root/Documents
    ├── /root/Downloads
    └── /root/WebLinux-Phase5-Tests/
```

### 1.1 Resolution Logic
In `WasmLinuxAdapter.ts`, rootfs sourcing is keyed directly by `options.desktop`:

```typescript
const profile = DEBIAN_DESKTOP_PROFILES[options.desktop];
const rootfsManifestId = profile?.rootfsManifestId || `debian-13-${options.desktop}`;
const rootDiskId = `root-${options.manifest.id}-${options.desktop}`;
const homeDiskId = `home-${options.manifest.id}`;

const rootfsBaseUri = options.desktop === 'kde-plasma'
  ? (options.manifest.imageSource.baseUri || '/disk/release/')
  : `/disk/${options.desktop}/`;
```

---

## 2. Shared User Home Coherence
- `/dev/wdb` (`home-debian`) is mounted at `/debian/root`.
- Regardless of which desktop environment is booted, the user's files and persistent configuration in `/root/` remain intact and shared.
- The root disk identity changes when switching desktops, but the home disk identity remains strictly constant (`home-debian`).
