# Ubuntu 24.04.5 LTS KDE Plasma 5.27 Qualification Report (Phase 6.5.2)

**Qualification Status:** `UBUNTU KDE PARTIALLY VALIDATED` (`validationStatus: "experimental"`)

## 1. Executive Summary

Phase 6.5.2 resolved the viewport overflow issue and verified visible Plasma 5.27 panel rendering, side-by-side Konsole and Dolphin window movement/resizing, cold vs. warm boot performance, clean shutdown, OPFS persistence, and cross-distribution isolation in Microsoft Edge (`msedge`).

### Root Cause & Fix for Viewport Sizing
- **Root Cause:** `apps/web/src/App.tsx` `<main>` and its inner desktop wrapper lacked `min-h-0`, while `apps/web/public/display.js` (`wantedSize()`) measured `stage.parentElement` (which included `#rv-bar`'s ~32px height) and applied that full height to `#screen`, creating a `+32px` per-frame resize feedback loop up to `1312px`.
- **Fix:** Added `min-h-0` to `<main>` and the desktop wrapper in `App.tsx`, and updated `display.js` (`wantedSize()`) to measure `#rv-stage` (`sbox.height`) or subtract `#rv-bar` height (`pbox.height - barH`).
- **Verified Layout:**
  - `1600x950` viewport: `innerHeight=950`, `scrollHeight=950`, `canvas=1600x616` (`top=78`, `bottom=694`, `viewportFits=true`).
  - `1280x800` resize: `innerHeight=800`, `scrollHeight=800`, `canvas.bottom=543` (`resizeResponsive=true`).
  - Plasma 5.27 floating panel (`Plasma`, `1438x44` at `x=81, y=572`) is 100% visible at the bottom of the desktop (`p652-01-desktop-panel.png`).

## 2. Performance Measurements (Cold vs. Warm Cache)

| Metric | Cold Cache (First Boot) | Warm Cache (Reboot in Same Context) |
|---|---|---|
| **Runtime-Ready (`running` + `shellReady`)** | `36s` | `49s` |
| **Plasma Splash Dismissed + Panel Mapped** | `167s` | — |
| **First Application Mapped (Konsole)** | `215s` | — |
| **Dolphin First Window Mapped** | `52s` (after launch; delayed by `udisks2` D-Bus `PermissionsInvalid` timeouts) | — |
| **Clean Shutdown (`Power Off` -> `stopped`)** | `1s` (`0` held OPFS locks) | `1s` |

## 3. Live Interactive & Window Operations Verified

- **Konsole 23.08.5:** Launches, renders `root@ubuntu-noble:/#`, accepts keyboard input (`echo phase651-konsole-ok; uname -m` -> `riscv64`), and moves/resizes (`24,44 793x459` -> `60,50 640x41`, `p652-window-ops.png`).
- **Dolphin 23.08.5:** Launches, renders `/root` contents (`Desktop`, `lost+found`, `dbus.log`, `kwin.log`, `plasma-shell.log`, `qt.log`, `ubuntu-kde-session.log`, `xwayland.log`), and moves (`52,72 760x410` -> `720,60 760x410`, `p652-dolphin-real.png`, `p652-window-ops.png`).
- **KRunner:** Opened via keyboard (`p652-04-dolphin-open.png`).
- **OPFS Persistence & Cross-Distro Isolation:** Confirmed across reboot (`phase652-persist.txt`) and isolated from Debian 13 KDE (`home-debian`) and Ubuntu CLI (`root-ubuntu`).

## 4. Remaining Gaps Keeping Status `PARTIALLY VALIDATED`

1. **Kickoff Application Launcher Click:** Clicking `(103, 672)` (`panel.x + 22`) did not open the Kickoff popup menu in `p652-launcher-real.png` (`Windows after Kickoff click: []`).
2. **Minimize/Restore Verification:** Clicking Dolphin's titlebar minimize coordinate in `p652-minimized.png` did not minimize the window.

## 5. Regression & Build Checks

- `node tests/phase6-ubuntu/run-all-tests.js`: **11/11** suites passed.
- `npm run build` (`apps/web`): `tsc && vite build` passed with zero errors.
