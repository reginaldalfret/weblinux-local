# WebLinux Local — Phase 4 Known Issues & Observations
## Operational Notes, Edge Cases & Roadmap Items

**Date:** November 23, 2026  
**Phase:** 4 Qualification  

---

## 1. Known Observations & Workarounds

### 1.1 Settle Time of KDE Plasma 6 Splash Screen
- **Behavior:** On initial boot, KDE Plasma 6 runs its full Breeze splash sequence (`ksplash: stage 1 ... stage 6`). This takes approximately 30–35 seconds before the wallpaper and panel completely fade in.
- **Root Cause:** Running full Qt 6 / KDE Plasma 6 desktop inside a simulated RISC-V 64-bit NOMMU WebAssembly processor incurs CPU overhead during initial QML parsing and D-Bus session registration.
- **Guidance:** Tests and end users should anticipate a ~35s startup window before sending interactive desktop commands.

### 1.2 PulseAudio Daemon Logging
- **Behavior:** PulseAudio daemon logs occasional warnings regarding missing udev device detection.
- **Impact:** Non-fatal. Audio operates over virtual ALSA PCM nodes (`/dev/snd/pcmC0D0p`) mapped to browser WebAudio buffers.

### 1.3 Guest Shell Execution Context
- **Behavior:** The default root prompt from the virtual serial console runs on the ramfs initramfs root (`/`).
- **Guidance:** To invoke Debian packages, commands must run inside the Debian 13 root (`chroot /debian /bin/sh -c "<cmd>"` or `/usr/local/bin/desktop wayland <app>`).

---

## 2. Recommended Phase 5 Focus Areas

1. **Audio Latency & WebAudio Synchronization:** Fine-tuning buffer sizes for real-time audio playback in media applications.
2. **Additional Desktop Profiles:** Expanding validated profiles to include IceWM and XFCE for ultra-low-memory environments.
3. **GPU Compute Shader Acceleration:** Extending WebGPU / Venus passthrough for accelerated 3D graphics rendering in guest applications.
