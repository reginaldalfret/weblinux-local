# Phase 15 — Storage & OPFS Integrity (`PHASE-08-STORAGE-INTEGRITY.md`)

## Storage Preservation Guarantees
- **Zero OPFS Reset:** `resetAll()` and `freshHomeDisk: true` were never called during Phase 15.
- **Preserved User Data:** `/root/browser-home`, `/home/ubuntu`, `~/.config`, `~/.local/share`, and `~/Downloads` were preserved across all rootfs cleanups.
- **Stable Disk Identities:** All root and home OPFS disk names (`root-debian-firefox`, `home-debian`, `root-ubuntu-kde-epiphany`, `home-ubuntu`, `root-arch-kde`, `home-arch-kde`, `root-opensuse-tumbleweed-kde`, `home-opensuse-tumbleweed-kde`, `root-fedora-kde`, `home-fedora-kde`, `root-alpine-kde`, `home-alpine-kde`) remain unchanged.

## Offline Filesystem & Chunk Verification
Every modified ext4 image passed `e2fsck -fy` and generated updated 1 MiB chunk `manifest.json` (with `present` hex bitmask) and `integrity.json` in both `D:\weblinux-disks\<distro>\` and `apps/web/public/disk\<distro>\`:

- **Alpine 3.24.4 KDE:** `e2fsck -fy` clean (`65745/200800` files, `436796/802816` blocks), `nonzero=1820/3136`, `sha256=4c9f39e521f9947a347110618909155989da8bceaf6d6210e6b07b9056c3defd`, `RECONSTRUCT_OK=True`.
- **Ubuntu 24.04.5 KDE:** `e2fsck -fy` clean (`77460/229376` files, `420347/917504` blocks), `nonzero=1862/3584`, `sha256=af0074751f4bd6a38810841531bc6fa5b2d47892605e2189917f4cbaa2e4aa1a`, `RECONSTRUCT_OK=True`.
- **Arch Linux KDE:** `e2fsck -fy` clean (`162480/327680` files, `1035789/1310720` blocks), `nonzero=3966/5120`, `sha256=157b94b4db6114c76e78d309b24c4dccf49f6f0d0257bd3e019238044a55b767`.
- **openSUSE Tumbleweed KDE:** `e2fsck -fy` clean (`109405/360448` files, `1048729/1441792` blocks), `nonzero=4824/5632`, `sha256=14c188114ac8c23a94f925b2964bbdc39b3a67fd601e4d77dd0ef3ffec6a365e`.
- **Fedora 45 KDE:** Unmodified (browser-free baseline preserved).
- **Debian 13 KDE:** Verified via `cleanup-debian-browser.sh` (`e2fsck -fy` clean and round-trip SHA-256 verified).

## Live OPFS Persistence Results (`tests/test-phase15-browser-removal.js`)
Verified `p15-user-preserve.txt` SHA-256 survival across `sync`, `window.weblinuxAdapter.shutdown()`, `page.reload()`, and re-boot on `alpine-kde` (`2f35228e...`), `fedora-kde` (`4dc8d55b...`), `ubuntu-kde-epiphany` (`fe064576...`), and `arch-kde` (`d08caf3f...`).
