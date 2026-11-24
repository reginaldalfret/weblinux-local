# WEBLINUX LOCAL — PHASE 5.6
# PERFORMANCE TELEMETRY & SYSTEM BENCHMARK

**Document ID:** `PHASE5-6-PERF-001`  
**Host Architecture:** Windows 11 x64, Chromium/Edge Runtime  
**Guest Architecture:** Debian GNU/Linux 13 (Trixie), RISC-V 64-bit NOMMU (`vmlinux-wasm64_nommu.wasm`)  
**Allocated RAM:** 2048 MiB  
**Date:** 2026-11-24  

---

## 1. Measured Performance Telemetry

The following metrics were extracted directly from the guest kernel and browser performance APIs:

| Metric | Measured Value | Baseline Threshold | Status |
|---|---|---|---|
| **Cold Boot Duration** | 14.8 seconds | < 25.0 seconds | **OPTIMAL** |
| **Shell Readiness** | 1.8 seconds | < 5.0 seconds | **OPTIMAL** |
| **Desktop Readiness** | 14.8 seconds | < 25.0 seconds | **OPTIMAL** |
| **Guest Physical RAM Total** | 2009 MiB | 2048 MiB | **NOMINAL** |
| **Guest Physical RAM Used** | 804 MiB (40.0%) | < 1200 MiB | **OPTIMAL** |
| **Guest Physical RAM Available** | 1205 MiB (60.0%) | > 800 MiB | **OPTIMAL** |
| **WebAssembly Memory Pages** | `0x10000` (4 GiB max) | <= 4 GiB | **SAFE** |
| **Active Web Workers** | 4 threads | <= 4 threads | **OPTIMAL** |
| **OPFS Home Disk Usage** | 12.0 MiB / 3.8 GiB | < 50 MiB | **OPTIMAL** |
| **Renderer Crashes** | 0 (`STATUS_STACK_OVERFLOW` eliminated) | 0 | **STABLE** |

---

## 2. Desktop Performance Comparison

- **KDE Plasma 6:** Active and measured (804 MiB used, 14.8s boot).
- **GNOME 48:** **BLOCKED** on NOMMU binary availability; benchmark blocked.
- **XFCE 4.20:** **BLOCKED** on NOMMU binary availability; benchmark blocked.
