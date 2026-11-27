# Phase 14.1 — Arch Linux Fix (`PHASE-02-ARCH-FIX.md`)

## Root Cause Identified
`/usr/lib/chromium/chromium` (`chromium-157.0.8103.78-1`, signed `riscv64` package from `extra`) failed to start with:
`error while loading shared libraries: libsimdutf.so.36: cannot open shared object file: No such file or directory`.

## Investigation & Pacman Verification (`task-10114`)
- Ran `pacman -Sy --noconfirm simdutf` inside `arch-kde.ext4` (`e2fsck -fy` clean, commit `a9e37cc`).
- Verified official `extra` repository package metadata:
  - Package: `simdutf 9.3.2-1` (`riscv64`, `extra`)
  - Provides: `libsimdutf.so=37-64` (`/usr/lib/libsimdutf.so.37.0.0`)
- Verified `https://riscv.mirror.pkgbuild.com/repo/extra/extra.db`: `chromium-157.0.8103.78-1` is the latest Chromium build in `extra` and was compiled against `libsimdutf.so.36`, whereas `extra` only ships `simdutf-9.3.2-1` (`libsimdutf.so.37`).
- Per project policy (no fake SONAME symlinks, no copying `.so` files from other distributions), `chromium-157.0.8103.78-1` remains blocked upstream until Arch RISC-V rebuilds `chromium` against `libsimdutf.so.37`.
- Also updated `/usr/local/bin/weblinux-browser` to use `setpriv`, `chmod 711 /root`, and `/tmp/runtime-browser`.
