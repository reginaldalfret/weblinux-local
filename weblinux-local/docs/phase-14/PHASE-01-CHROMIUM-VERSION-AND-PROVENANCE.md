# Phase 14.1 — Chromium Stable Version & Source Provenance

**Date:** 2026-11-27  
**Canonical Upstream:** `https://chromium.googlesource.com/chromium/src.git`

---

## 1. Pinned Upstream Stable Release (`chromiumdash`)

Queried `https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Linux&num=3`:
- **Current Linux Stable:** `158.0.8127.88` (Milestone `158`, commit `0cefb18236a23db1ebb6b2bc040fbbaf8cbe759e`)
- **Prior Stable Releases:**
  - `158.0.8127.36` (Milestone `158`, commit `14d6f648e8cd7ad750a4044200ce94d3321be260`)
  - `157.0.8103.78` (Milestone `157`, commit `4b3d0dabb8250b6f152d2d85d79e7706e309d087`)

## 2. Upstream RISC-V Verification

Inspected `0cefb18236a23db1ebb6b2bc040fbbaf8cbe759e` in `chromium.googlesource.com`:
- `build/config/compiler/BUILD.gn:2199` explicitly includes `current_cpu == "riscv64"`.
- `sandbox/linux/BUILD.gn` wires `use_seccomp_bpf` (`seccomp-bpf` + `bpf_dsl`) for Linux targets.
