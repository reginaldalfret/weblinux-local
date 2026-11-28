# Phase 15 — Browser Removal & Terminal Internet Regression Suite

## Overview

`tests/test-phase15-browser-removal.js` is the Phase 15 end-to-end Playwright + Microsoft Edge regression test verifying that native browser applications and wrappers have been cleanly removed across all six KDE/desktop distributions while terminal networking, Plasma Wayland rendering, and OPFS persistent storage remain intact.

## Usage

```bash
node tests/test-phase15-browser-removal.js <distroId>
```

Supported `<distroId>` values:
- `debian-firefox`
- `ubuntu-kde-epiphany`
- `arch-kde`
- `opensuse-tumbleweed-kde`
- `fedora-kde`
- `alpine-kde`

Requires the WebLinux dev server running at `http://localhost:3000`.

## Verification Stages

1. **Cold Boot (No Storage Reset)**
   - Launches Microsoft Edge via Playwright (`channel: 'msedge'`) with `SharedArrayBuffer` enabled.
   - Navigates to `http://localhost:3000` without calling `resetAll()` or `freshHomeDisk: true`.
   - Selects the target distribution and clicks `Configure Desktop` -> `Launch`, waiting for `state === 'running'` and `shellReady === true`.

2. **Browser Removal Verification**
   - Confirms `command -v` finds none of: `epiphany`, `chromium`, `firefox`, `badwolf`, `netsurf-gtk`, `falkon`.
   - Queries the distribution's native package manager (`dpkg -l`, `pacman -Q`, `rpm -q`, `apk info -e`) to confirm none of those browser packages remain installed.
   - Verifies `/usr/local/bin/weblinux-browser` and `/usr/share/applications/weblinux-browser.desktop` do not exist.

3. **Terminal Internet Access & Security Policy**
   - `getent hosts example.com` (DNS resolution)
   - `curl -sSI --max-time 12 https://example.com` (`HTTP/2 200` or `HTTP/1.1 200` TLS/HTTPS verification)
   - `curl -sL --max-time 12 https://example.com -o /tmp/p15-example.html && sha256sum /tmp/p15-example.html`
   - `git ls-remote https://github.com/git/git.git HEAD`
   - Native package manager metadata refresh/check (`apt-get update`, `pacman -Sy`, `zypper --non-interactive refresh`, `dnf5 repolist`, `apk update`)
   - `curl -s --max-time 4 http://192.168.1.1` blocked (`RFC1918_BLOCKED_OK`)

4. **Plasma Desktop & OPFS Persistence**
   - Waits for Plasma Wayland desktop readiness and captures `tests/screenshots/phase15/p15-<distroId>-desktop.png`.
   - Writes `p15-user-preserve.txt` in persistent home (`/home/ubuntu` for `ubuntu-kde-epiphany`, `/root` for the remaining five distributions), records its SHA-256 digest, and runs `sync`.
   - Calls `window.weblinuxAdapter.shutdown()`, executes `page.reload()`, re-launches the distribution, and verifies `p15-user-preserve.txt` content and SHA-256 match.

## Outputs

- Screenshot: `tests/screenshots/phase15/p15-<distroId>-desktop.png`
- JSON summary: `tests/screenshots/phase15/p15-<distroId>-result.json`

## Syntax Validation

Validated with:
```
node -c E:\Web-Linux\weblinux-local\tests\test-phase15-browser-removal.js
```
Exit code: `0`. Live per-distro execution is pending sequential disk repackaging by the Lead Orchestrator.
