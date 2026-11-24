# WebLinux Local — Phase 6.4: Ubuntu GNOME Qualification Status

## 1. Distribution & Desktop Lifecycle Matrix

| Distribution | Desktop Environment | Phase First Introduced | Qualification Status | Primary Execution Engine |
|---|---|---|---|---|
| **Debian 13 (Trixie)** | KDE Plasma 6.3.0 | Phase 4 | **Validated (Reference)** | WebAssembly NOMMU + Wayland |
| **Debian 13 (Trixie)** | GNOME 48.0 | Phase 5.1 | **Blocked (Upstream Images)** | Mutter/Shell absent from Debian image |
| **Debian 13 (Trixie)** | XFCE 4.20.0 | Phase 5.1 | **Blocked (Upstream Images)** | Labwc/XFCE absent from Debian image |
| **Ubuntu 24.04.5 LTS** | CLI Interactive Shell | Phase 6.3 | **Validated** | WebAssembly NOMMU + /bin/rv |
| **Ubuntu 24.04.5 LTS** | GNOME 46.0 | Phase 6.4 | **Validated (Experimental)** | WebAssembly NOMMU + Mutter 46 |
| **Ubuntu 24.04.5 LTS** | KDE Plasma | Phase 6.4 | **Not Required (GNOME Succeeded)** | Fallback not activated |

---

## 2. Gate Decision: GNOME vs. KDE Fallback
Under Phase 6.4 rules:
- **Mandate:** "GNOME First. KDE only as a verified fallback if GNOME is demonstrated to be technically infeasible."
- **Outcome:** GNOME 46 packages (`gnome-shell`, `mutter`, `gjs`, `libmozjs-115`) were successfully acquired, verified, packaged into a 3.0 GiB ext4 disk image, and booted in Microsoft Edge.
- **Evaluation:** GJS successfully executes under NOMMU via `GJS_DISABLE_JIT=1` without memory page violations. Mutter 46 successfully launches as a nested Wayland display server (`libmutter-Message: Running GNOME Shell (using mutter 46.2) as a Wayland display server`).
- **Conclusion:** **GNOME 46 is technically viable and successfully implemented.**
  Because GNOME has achieved functional qualification, activating the KDE Plasma fallback is **unnecessary and declined**.
