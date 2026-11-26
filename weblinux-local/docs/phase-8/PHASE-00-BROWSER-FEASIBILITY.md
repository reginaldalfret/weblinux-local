# Phase 0 — Browser Integration Baseline & Feasibility

## 1. Repository Baseline
- **Branch:** `feature/runtime-foundations`
- **HEAD:** `c2f5c70` (`feat(gpu): compile virglrenderer vrend.wasm and validate Mesa virpipe RVGPU acceleration`)
- **Working Tree:** Clean at start of Phase 8.

## 2. Display, GPU & Network Stack Baseline
- **Wayland Compositor:** `wlserver` (`WLSERVER_SHELL=plasma` for KDE) presents surfaces to `display.js` (`window.rvDisplay`) over `BroadcastChannel("rv-display-" + rvTabId)` and shared-memory table.
- **RVGPU Stack:** `gpuserver` (`/run/rvgpu/boot.js` + `server.js`) connects over `4 MiB` shared-memory ring to `gpu-exec.js` (`vrend.js` + `vrend.wasm`, `virglrenderer 1.1.1` on WebGL2/ANGLE), already validated on Ubuntu KDE (`1,235` VirGL records, `0` errors).
- **Guest Network Stack:**
  - Kernel driver: `drivers/net/wasm_net.c` (`eth0`).
  - Guest init (`/init`): configures `eth0` at `10.0.5.2/24`, default gateway `10.0.5.1`, and `/etc/resolv.conf` (`nameserver 10.0.5.1`) when `ip=` and `dns=` are passed on kernel cmdline.
  - Browser transport (`apps/web/public/linux.js`): forwards raw Ethernet frames over WebSocket (`ws://127.0.0.1:8081` when `enableNetworking: true` in `App.tsx`).
  - Current gap: `App.tsx` sets `enableNetworking: false` by default, and no WebSocket Ethernet relay is running on `127.0.0.1:8081` on Windows.

## 3. Target Browser Matrix
| Distribution | Target Browser | Official `riscv64` Package |
|---|---|---|
| Debian 13 Trixie | Firefox ESR | `firefox-esr` (`main`) |
| Ubuntu 24.04.5 Noble | Epiphany Web | `epiphany-browser` (`universe`) |
