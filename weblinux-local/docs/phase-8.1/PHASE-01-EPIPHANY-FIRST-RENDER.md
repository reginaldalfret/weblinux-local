# Phase 8.1 — Phase 1: Epiphany First-Page Rendering Investigation & Fix

**Date:** 2026-11-26

---

## 1. Root Cause Analysis

1. **WebKitGTK 6.0 Process & Compositor Findings:**
   - Default GTK4 `ngl`/`gl` renderer stalls on `llvmpipe` shader compilation; `GSK_RENDERER=cairo` is required for GTK4 window presentation.
   - Default WebKitGTK compositing freezes the guest display after `~2m33s` (`task-7938`); `WEBKIT_DISABLE_COMPOSITING_MODE=1` + `WEBKIT_DISABLE_DMABUF_RENDERER=1` + `LIBGL_ALWAYS_SOFTWARE=1` + `JSC_useJIT=0` + `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` + `GTK_A11Y=none` keep `WebKitWebProcess` and `wlserver` stable.
2. **Epiphany-Specific Overhead vs `MiniBrowser`:**
   - **First-run `ephy-profile-migrator`:** Executes 38 migrators (`~21s`).
   - **D-Bus Secret Service (`org.freedesktop.secrets`):** Epiphany queries `org.freedesktop.secrets` both during migration and startup (`~30s` delay logging `GDBus.Error:org.freedesktop.DBus.Error.ServiceUnknown`).
   - **Sandbox Path Warning:** `CRITICAL: Attempted to add disallowed path to sandbox: /root/.config/epiphany`.
   - **CPU Contention & 10s Unresponsive Modal:** Launching Epiphany during Plasma 5.27's `~105s` first-boot setup starves `WebKitWebProcess`, triggering Epiphany's 10-second `"Page Unresponsive"` dialog before first WebView paint.
3. **First-Render Isolation Proof (`task-8042`):**
   - Launching `/usr/lib/riscv64-linux-gnu/webkitgtk-6.0/MiniBrowser https://example.com` after Plasma settled (`105s` post-boot) with the above NOMMU flags eliminated the migrator, Secret Service delay, and unresponsive modal, completing full HTTPS first-page paint (`Example Domain`, `p81-01-minibrowser-95s.png`) using `959 MiB` RAM out of `2009 MiB`.
