# Phase 14 — Browser Installation (`PHASE-02-BROWSER-INSTALLATION.md`)

## Installation & Image Packaging Summary

All newly installed browsers were added to their distribution's ext4 root filesystem, checked with `e2fsck -fy`, sliced into 1 MiB chunks, and registered in `apps/web/public/manifests/*.json`. Each newly modified image also configures an unprivileged `browser` user (`uid=1000`), `HOME=/root/browser-home` (residing on persistent `/dev/wdb`), `/usr/local/bin/weblinux-browser`, and `/usr/share/applications/weblinux-browser.desktop`.

| Distribution | Browser Installed | Image Size | Non-Zero Chunks | RootFS SHA-256 | Commit |
|---|---|---|---|---|---|
| **Alpine 3.24.4 KDE** | `epiphany 50.4-r0` + `webkit2gtk-6.0 2.48.1-r4` | 3136 MiB | 1693 | `addc411837962ffc862f8ffc3290d6cab35203619b2f7713e25ee58f89ae7d1f` | `66c32b08defecb893d6b7c07180334d89a6a148f` |
| **openSUSE Tumbleweed KDE** | `chromium-155.0.8059.84-238.1.riscv64` | 5632 MiB | 4542 | `601e76975cd48f814e2b54d9f28f4b84915f4f0f838c043c6efddcda311dca71` | `e1f68ec6844d3bdb00c1ebdaa3d280dd4bb9f59b` |
| **Arch Linux KDE** | `chromium-157.0.8103.78-1` | 5120 MiB | 4325 | `e23672fa5d6dc859b2410d658e1aba402f3fd00c5a71aa5ef3eb80097db2f29` | `b13cb8cd654884a10c490d8ad8516ed0b9fbc4c5` |
| **Debian 13 KDE** | `epiphany-browser 48.5-0+deb13u1` + `libwebkitgtk-6.0-4 2.52.6-1~deb13u1` | 8192 MiB | 4448 | `7dc22da1c8d775bfa3c25156ac2da7206f7a4a1afc3684ada9d53cbf84799fd5` | `869ea7a` |
| **Ubuntu 24.04.5 KDE** | `epiphany-browser` (`Web 46.5`, pre-installed) | — | — | Existing Phase 8/8.1 image | — |
| **Fedora 45 KDE** | **BLOCKED** (unsigned `riscv-koji` RPMs) | — | — | Unmodified (`gpgcheck=1` preserved) | — |

## Unsandboxed Wrapper Flags
- **Epiphany / WebKitGTK (Alpine, Debian):** `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`, `JSC_useJIT=0`, `GDK_BACKEND=wayland`, `HOME=/root/browser-home`.
- **Chromium (Arch, openSUSE):** `--no-sandbox --ozone-platform=wayland --disable-gpu --password-store=basic`.
