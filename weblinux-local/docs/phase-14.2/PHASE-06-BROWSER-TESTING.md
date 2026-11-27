# Phase 14.2 — Browser QA & Integration Testing (`tests/test-phase14-browser.js`)

## Overview

`tests/test-phase14-browser.js` is the Playwright-driven live browser qualification and OPFS persistence test suite for WebLinux Phase 14.2. It boots each supported RISC-V distribution in Microsoft Edge (`channel: 'msedge'`) with `SharedArrayBuffer` enabled, verifies native RISC-V browser binaries and wrapper scripts, validates HTTPS/DNS and RFC1918 isolation, exercises local HTML/CSS/JS/Canvas rendering and live HTTPS page rendering under Plasma Wayland, inspects browser subprocesses and memory usage, and verifies OPFS persistence across a clean shutdown and `page.reload()`.

## Usage

```bash
node tests/test-phase14-browser.js <distroId>
```

### Supported `distroId` Configurations

| `distroId` | `chrootCmd` | `rootMount` | `browserName` | `binaryCandidates` | `browserHome` | `plasmaWaitMs` | `browserWaitMs` |
|---|---|---|---|---|---|---|---|
| `debian-firefox` | `debian` | `/debian` | `Epiphany` | `/usr/bin/epiphany` | `/root/browser-home` | `95000` | `45000` |
| `ubuntu-kde-epiphany` | `ubuntu-kde` | `/ubuntu` | `Epiphany` | `/usr/bin/epiphany` | `/home/ubuntu` | `95000` | `45000` |
| `arch-kde` | `arch-root` | `/arch` | `Epiphany` | `/usr/bin/epiphany`, `/usr/bin/chromium` | `/root/browser-home` | `110000` | `60000` |
| `opensuse-tumbleweed-kde` | `opensuse-root` | `/opensuse` | `Epiphany` | `/usr/bin/epiphany` | `/root/browser-home` | `145000` | `45000` |
| `alpine-kde` | `alpine-root` | `/alpine` | `Epiphany` | `/usr/bin/epiphany` | `/root/browser-home` | `120000` | `45000` |

> **Notes:**
> - `opensuse-tumbleweed-kde` uses `plasmaWaitMs: 145000` so KDE Plasma 6 completes painting before screenshot capture.
> - `arch-kde` targets `Epiphany` with `binaryCandidates: ['/usr/bin/epiphany', '/usr/bin/chromium']`.

## Test Phases

1. **Cold Boot (`selectAndLaunch`)**:
   - Opens `http://localhost:3000`, selects the distribution and desktop configuration, clicks Launch, and waits for `window.weblinuxAdapter.status.state === 'running'` and `shellReady === true`.
2. **Binary, Architecture, & Wrapper Inspection**:
   - Checks `/etc/os-release` (or `/etc/alpine-release`), `/bin/rv`, `/usr/local/bin/weblinux-browser` (`WRAPPER_EXECUTABLE_OK`), and `id browser`.
   - Probes `binaryCandidates` for `FOUND_BINARY=<path>`, verifies RISC-V ELF architecture via `readelf -h` (`Class:` / `Machine:`) or `file -L`, and runs `<binary> --version`.
3. **Network & RFC1918 Isolation**:
   - Verifies DNS resolution (`getent hosts example.com`) and TLS/HTTPS connectivity (`curl -sI --max-time 12 https://example.com`).
   - Confirms private-network isolation (`curl -s --max-time 4 http://192.168.1.1` fails -> `RFC1918_BLOCKED_OK`).
4. **Desktop & Local HTML/CSS/JS/Canvas Test**:
   - Waits `plasmaWaitMs` for Plasma Wayland to finish painting.
   - Generates `/tmp/p14-test.html` containing DOM JS execution (`JS_OK`) and a 2D `<canvas>` (`HTML_CSS_JS_CANVAS_OK`).
   - Creates `${browserHome}/.config/p14-profile-marker.txt` and `${browserHome}/.local/share/epiphany/p14-bookmark.txt`.
   - Downloads `https://example.com` to `${browserHome}/Downloads/example.html` and records its `sha256sum` (`DOWNLOAD_SHA256`).
   - Launches `file:///tmp/p14-test.html` via `/usr/local/bin/weblinux-browser` (or Wayland Epiphany fallback), waits 15s, and captures `tests/screenshots/phase14/p14-<distroId>-local.png`.
5. **Live HTTPS Render, Subprocesses, & Memory**:
   - Launches `https://example.com` and waits `browserWaitMs`.
   - Runs `ps -ef` filtering for `chromium|epiphany|firefox|WebKitNetworkProcess|WebKitWebProcess|WebKit` and `free -m`, plus tails `/tmp/p14-browser.log`.
   - Captures `tests/screenshots/phase14/p14-<distroId>-example.png`.
6. **Clean Shutdown & OPFS Persistence (`page.reload()`)**:
   - Runs `sync` in the guest and calls `window.weblinuxAdapter.shutdown()`.
   - Calls `page.reload({ waitUntil: 'domcontentloaded' })` and re-launches the distribution.
   - Verifies `${browserHome}/.config/p14-profile-marker.txt`, `${browserHome}/.local/share/epiphany/p14-bookmark.txt`, and `${browserHome}/Downloads/example.html` persist, and asserts `PERSISTED_SHA256 === initialSha256`.
   - Captures `tests/screenshots/phase14/p14-<distroId>-persisted.png`.

## Output Artifacts

Each run writes:
- `tests/screenshots/phase14/p14-<distroId>-local.png`
- `tests/screenshots/phase14/p14-<distroId>-example.png`
- `tests/screenshots/phase14/p14-<distroId>-persisted.png`
- `tests/screenshots/phase14/p14-<distroId>-result.json` (includes `coldBootSec`, `warmReloadBootSec`, `initialSha256`, `persistedSha256`, `checks`, and `status`: `PASS`, `PARTIAL`, or `FAILED`)

If `status !== 'PASS'`, the script exits with `process.exitCode = 1`.
