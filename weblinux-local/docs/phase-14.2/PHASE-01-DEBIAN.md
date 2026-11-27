# Phase 14.2 — Debian 13 (Trixie) Browser Fix (`PHASE-01-DEBIAN.md`)

## 1. Debian Trixie `riscv64` Package Index Audit

Queried `https://deb.debian.org/debian/dists/trixie/main/binary-riscv64/Packages.xz` and `https://security.debian.org/debian-security/dists/trixie-security/main/binary-riscv64/Packages.xz` via WSL:

| Package | Repository | Version | `.deb` Size (B) | Installed-Size (KiB) | Notes |
|---|---|---|---|---|---|
| `epiphany-browser` | `trixie/main` | `48.5-0+deb13u1` | `763520` | `2038` | Primary browser (WebKitGTK); already installed |
| `dbus` | `trixie/main` | `1.16.2-2` | `71492` | `146` | Provides `/usr/bin/dbus-run-session` |
| `netsurf-gtk` | `trixie/main` | `3.11-2` | `1506872` | `4856` | Lightweight signed GTK3 fallback (no WebKitGTK/JSC) |
| `firefox-esr` | `trixie-security/main` | `153.8.0esr-1~deb13u1` | `75437620` | `262608` | Too heavy for 2048 MiB NOMMU (~256 MiB installed) |
| `luakit` | `trixie/main` | `1:2.4.0-1+b1` | `437648` | `3847` | WebKit2GTK-based |
| `surf` | `trixie/main` | `2.1+git20250419-1` | `26860` | `93` | WebKit2GTK-based |
| `qutebrowser` | `trixie/main` | `3.4.0-1` | `1748280` | `5523` | QtWebEngine-based |
| `falkon` | `trixie/main` | *Not available* | — | — | Not packaged for `trixie/main` `riscv64` |
| `chromium` | `trixie/main` | *Not available* | — | — | Not packaged for `trixie/main` `riscv64` |

## 2. Root-Cause Analysis: `libz.so.1: failed to map segment from shared object`

In Phase 14.1 live testing (`p14-debian-firefox-result.json`), `setpriv` resolved the `su: Authentication failure` issue, but launching `/usr/bin/epiphany` after KDE Plasma 6 startup failed with:

```text
Mem: total 2009 MiB, used 1374 MiB, free 633 MiB, buff/cache 506 MiB, available 635 MiB, Swap 0
/usr/bin/epiphany: error while loading shared libraries: libz.so.1: failed to map segment from shared object
```

### Contributing Factors
1. **NOMMU Physical Contiguity & Page Cache Fragmentation:** Under `linux-wasm64_nommu-6.1` (`2048 MiB` RAM, `0` Swap), `ld.so` `mmap()` calls for ELF `PT_LOAD` segments require contiguous physical memory pages. After Plasma 6 boots, `506 MiB` is held in `buff/cache` and the buddy allocator is fragmented. Mapping WebKitGTK's 100+ shared libraries (`libwebkitgtk-6.0.so.4`, `libjavascriptcoregtk-6.0.so.1`, `libgtk-4.so.1`, `libgst*`, `libicudata`, `libz.so.1`) exhausts contiguous regions mid-chain.
2. **Glibc Multi-Arena Allocation:** By default, glibc `malloc` creates up to `8 * nproc` arenas, reserving large `mmap` heaps during startup. Setting `MALLOC_ARENA_MAX=2` caps arena proliferation and reduces `mmap` fragmentation.
3. **Unprivileged `browser` (`uid=1000`) Environment Gaps:**
   - `/root` defaults to `0700`, blocking `browser` from traversing `/root/browser-home` (`HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`).
   - `XDG_RUNTIME_DIR` must be `0700` owned by `browser:browser` (`/tmp/runtime-browser`), with `/tmp/runtime-root/wayland-0` symlinked into `/tmp/runtime-browser/wayland-0`.
   - `DBUS_SESSION_BUS_ADDRESS` previously pointed to `root`'s `/tmp/runtime-root/bus`; unsetting it and launching via `/usr/bin/dbus-run-session` provides an isolated session bus for `uid=1000`.

## 3. Implementation (`scripts/install-debian-browser.sh`)

Created [`scripts/install-debian-browser.sh`](file:///E:/Web-Linux/weblinux-local/scripts/install-debian-browser.sh) to:
1. **Reconstruct** `/root/debian-build/debian-13-firefox.ext4` from `/mnt/d/weblinux-disks/debian-13-firefox/manifest.json` and 1 MiB chunks.
2. **Install signed packages** (with standard Debian GPG verification intact, never `--allow-unauthenticated`) inside `qemu-riscv64-static` chroot:
   - `epiphany-browser` (`48.5-0+deb13u1`)
   - `dbus` (`1.16.2-2`, for `dbus-run-session`)
   - `netsurf-gtk` (`3.11-2`, lightweight signed fallback if `epiphany` still exits `127` due to `ld.so` `mmap` failure)
3. **Update `/usr/local/bin/weblinux-browser`:**
   - `chmod 711 /root` and `chown -R browser:browser /root/browser-home`
   - `mkdir -p /tmp/runtime-browser`, `chown browser:browser /tmp/runtime-browser`, `chmod 700 /tmp/runtime-browser`, `ln -sf /tmp/runtime-root/wayland-0 /tmp/runtime-browser/wayland-0`
   - `sync` + `echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true` as `root` before privilege drop to reclaim `buff/cache` pages
   - Export `MALLOC_ARENA_MAX=2`, `JSC_useJIT=0`, `WEBKIT_DISABLE_COMPOSITING_MODE=1`, `WEBKIT_DISABLE_DMABUF_RENDERER=1`, `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`, `GDK_BACKEND=wayland`, `GSK_RENDERER=cairo`, `LIBGL_ALWAYS_SOFTWARE=1`, `NO_AT_BRIDGE=1`, `GTK_A11Y=none`
   - Drop privileges with `setpriv --reuid="$BUID" --regid="$BGID" --clear-groups /usr/bin/dbus-run-session -- /usr/bin/epiphany "$@"` (falling back to `/usr/bin/netsurf-gtk "$@"` only if `epiphany` exits `127`)
4. **Verify & Re-slice:** Run `e2fsck -fy`, re-slice 1 MiB chunks to `/mnt/d/weblinux-disks/debian-13-firefox`, write `manifest.json` (with `present` hex bitmask) and `integrity.json` to both `/mnt/d/weblinux-disks/debian-13-firefox` and `apps/web/public/disk/debian-13-firefox`, and verify round-trip SHA-256.

## 4. Verification Status

- `bash -n /mnt/e/Web-Linux/weblinux-local/scripts/install-debian-browser.sh`: **PASS (`SYNTAX_OK`)**.
- Multi-GiB ext4 reconstruction/re-slicing: **Deferred to Lead Orchestrator** (not executed in this session per WSL 3.5 GiB RAM constraint).
