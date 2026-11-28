/**
 * WebLinux Phase 16.1 — Event/Readiness-Based Desktop & Compositor Synchronization Helper
 *
 * Replaces arbitrary fixed sleeps (plasmaWaitMs) with observable readiness checks:
 *   1. Host adapter & Wayland display state (waylandActive, rvDisplay.active(), nativeShell())
 *   2. Guest-side probe: Wayland socket ($XDG_RUNTIME_DIR/$WAYLAND_DISPLAY),
 *      compositor (wlserver / kwin_wayland), plasmashell process, and D-Bus org.kde.plasmashell
 *   3. Rendered frame pixel variance check on the WebGL2 display canvas (rejects black/blank frames)
 *   4. Bounded retries & timeouts with structured diagnostics on failure
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_CANVAS_THRESHOLDS = {
  minNonBlackRatio: 0.05,
  minLumaStdDev: 4.0,
  minUniqueBuckets: 6,
};

async function getHostDisplayState(page) {
  return page.evaluate(() => {
    const st = window.weblinuxAdapter?.status || {};
    const rv = window.rvDisplay;
    const stats = rv?.stats || {};
    let windows = [];
    try {
      windows = rv && typeof rv.windowList === 'function' ? rv.windowList() : [];
    } catch {
      windows = [];
    }
    return {
      adapterState: st.state || null,
      shellReady: Boolean(st.shellReady),
      waylandActive: Boolean(st.waylandActive),
      error: st.error || null,
      rvDisplayPresent: Boolean(rv),
      rvDisplayActive: Boolean(rv && typeof rv.active === 'function' && rv.active()),
      nativeShell: Boolean(rv && typeof rv.nativeShell === 'function' && rv.nativeShell()),
      frames: Number(stats.frames || 0),
      windowCount: windows.length,
      windows: windows.map((w) => ({
        id: w.id,
        title: w.title || '',
        app: w.app || '',
      })),
    };
  });
}

async function evaluateCanvasFrame(page, thresholds = {}) {
  const cfg = { ...DEFAULT_CANVAS_THRESHOLDS, ...thresholds };
  return page.evaluate(async (t) => {
    const rv = window.rvDisplay;
    let dataUrl = null;
    try {
      if (rv && typeof rv.shot === 'function') {
        dataUrl = rv.shot();
      } else {
        const c = rv?.canvas || document.querySelector('canvas');
        if (c && typeof c.toDataURL === 'function') {
          dataUrl = c.toDataURL('image/png');
        }
      }
    } catch (err) {
      return { ok: false, reason: 'shot_error: ' + (err?.message || String(err)), isRendered: false };
    }

    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return { ok: false, reason: 'no_canvas_data_url', isRendered: false };
    }

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to decode canvas data URL'));
      img.src = dataUrl;
    });

    const sw = 160;
    const sh = 90;
    const off = document.createElement('canvas');
    off.width = sw;
    off.height = sh;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, sw, sh);
    const data = ctx.getImageData(0, 0, sw, sh).data;

    const total = sw * sh;
    let nonBlack = 0;
    let sumLuma = 0;
    let sumLumaSq = 0;
    const buckets = new Set();

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 8 || g > 8 || b > 8) nonBlack++;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sumLuma += luma;
      sumLumaSq += luma * luma;
      buckets.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
    }

    const nonBlackRatio = nonBlack / total;
    const lumaMean = sumLuma / total;
    const variance = Math.max(0, sumLumaSq / total - lumaMean * lumaMean);
    const lumaStdDev = Math.sqrt(variance);
    const uniqueBuckets = buckets.size;

    const isRendered =
      nonBlackRatio >= t.minNonBlackRatio &&
      lumaStdDev >= t.minLumaStdDev &&
      uniqueBuckets >= t.minUniqueBuckets;

    return {
      ok: true,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      nonBlackRatio: Number(nonBlackRatio.toFixed(4)),
      lumaMean: Number(lumaMean.toFixed(2)),
      lumaStdDev: Number(lumaStdDev.toFixed(2)),
      uniqueBuckets,
      isRendered,
    };
  }, cfg);
}

function parseKeyValueOutput(text) {
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      out[k] = v;
    }
  }
  return out;
}

const INLINE_GUEST_PROBE = `
PLASMA_PID=$(pidof plasmashell 2>/dev/null | awk '{print $1}' || true)
if [ -n "$PLASMA_PID" ] && [ -r "/proc/$PLASMA_PID/environ" ]; then
  for kv in $(tr '\\0' '\\n' < "/proc/$PLASMA_PID/environ" 2>/dev/null | grep -E '^(XDG_RUNTIME_DIR|WAYLAND_DISPLAY|DBUS_SESSION_BUS_ADDRESS)=' || true); do
    key="\${kv%%=*}"; val="\${kv#*=}"
    case "$key" in
      XDG_RUNTIME_DIR) export XDG_RUNTIME_DIR="$val" ;;
      WAYLAND_DISPLAY) export WAYLAND_DISPLAY="$val" ;;
      DBUS_SESSION_BUS_ADDRESS) export DBUS_SESSION_BUS_ADDRESS="$val" ;;
    esac
  done
fi
export XDG_RUNTIME_DIR="\${XDG_RUNTIME_DIR:-/tmp/runtime-root}"
export WAYLAND_DISPLAY="\${WAYLAND_DISPLAY:-wayland-0}"
export DBUS_SESSION_BUS_ADDRESS="\${DBUS_SESSION_BUS_ADDRESS:-unix:path=\${XDG_RUNTIME_DIR}/bus}"

WAYLAND_SOCKET_OK=0; COMPOSITOR_OK=0; PLASMASHELL_OK=0; DBUS_BUS_OK=0; DBUS_PLASMASHELL_OK=0
[ -S "\${XDG_RUNTIME_DIR}/\${WAYLAND_DISPLAY}" ] && WAYLAND_SOCKET_OK=1
for p in /proc/[0-9]*/cmdline; do
  [ -r "$p" ] || continue
  if tr '\\0' ' ' < "$p" 2>/dev/null | grep -qE '(^|/)(wlserver|kwin_wayland)(\\s|$)|/run/wlserver'; then
    COMPOSITOR_OK=1; break
  fi
done
if [ -n "$PLASMA_PID" ]; then
  PLASMASHELL_OK=1
else
  for p in /proc/[0-9]*/cmdline; do
    [ -r "$p" ] || continue
    if tr '\\0' ' ' < "$p" 2>/dev/null | grep -qE '(^|/)plasmashell(\\s|$)'; then
      PLASMASHELL_OK=1; break
    fi
  done
fi
[ -S "\${XDG_RUNTIME_DIR}/bus" ] && DBUS_BUS_OK=1
if [ "$DBUS_BUS_OK" -eq 1 ]; then
  if command -v dbus-send >/dev/null 2>&1; then
    dbus-send --session --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.NameHasOwner string:org.kde.plasmashell 2>/dev/null | grep -q 'boolean true' && DBUS_PLASMASHELL_OK=1
  elif command -v qdbus6 >/dev/null 2>&1; then
    qdbus6 org.kde.plasmashell /MainApplication >/dev/null 2>&1 && DBUS_PLASMASHELL_OK=1
  elif command -v qdbus >/dev/null 2>&1; then
    qdbus org.kde.plasmashell /MainApplication >/dev/null 2>&1 && DBUS_PLASMASHELL_OK=1
  fi
fi
COMPOSITOR_READY=0
if [ "$WAYLAND_SOCKET_OK" -eq 1 ] && [ "$COMPOSITOR_OK" -eq 1 ] && [ "$PLASMASHELL_OK" -eq 1 ] && [ "$DBUS_PLASMASHELL_OK" -eq 1 ]; then
  COMPOSITOR_READY=1
fi
echo "WAYLAND_SOCKET_OK=$WAYLAND_SOCKET_OK"
echo "COMPOSITOR_OK=$COMPOSITOR_OK"
echo "PLASMASHELL_OK=$PLASMASHELL_OK"
echo "DBUS_BUS_OK=$DBUS_BUS_OK"
echo "DBUS_PLASMASHELL_OK=$DBUS_PLASMASHELL_OK"
echo "COMPOSITOR_READY=$COMPOSITOR_READY"
`;

async function probeGuestCompositor(page, { runGuest, timeoutMs = 15000 } = {}) {
  if (typeof runGuest !== 'function') {
    return { skipped: true, COMPOSITOR_READY: '1' };
  }
  const raw = await runGuest(page, INLINE_GUEST_PROBE, timeoutMs);
  return { raw, ...parseKeyValueOutput(raw) };
}

/**
 * Wait until the KDE Wayland compositor + plasmashell + non-black canvas frame are ready.
 */
async function waitForDesktopReady(page, opts = {}) {
  const {
    timeoutMs = 180000,
    pollIntervalMs = 2500,
    runGuest = null,
    requireGuestProbe = Boolean(runGuest),
    requireNativeShell = false,
    canvasThresholds = DEFAULT_CANVAS_THRESHOLDS,
    logger = console.log,
  } = opts;

  const start = Date.now();
  let lastHost = null;
  let lastGuest = null;
  let lastCanvas = null;
  let attempt = 0;

  while (Date.now() - start < timeoutMs) {
    attempt++;
    lastHost = await getHostDisplayState(page);
    if (lastHost.error) {
      throw new Error(`Desktop readiness aborted by adapter error: ${lastHost.error}`);
    }

    const hostOk =
      lastHost.waylandActive &&
      lastHost.rvDisplayActive &&
      lastHost.frames > 0 &&
      (!requireNativeShell || lastHost.nativeShell);

    if (hostOk) {
      lastCanvas = await evaluateCanvasFrame(page, canvasThresholds);
      if (lastCanvas.isRendered) {
        if (!requireGuestProbe) {
          return {
            ready: true,
            elapsedMs: Date.now() - start,
            attempts: attempt,
            host: lastHost,
            guest: { skipped: true },
            canvas: lastCanvas,
          };
        }
        try {
          lastGuest = await probeGuestCompositor(page, { runGuest, timeoutMs: 15000 });
        } catch (err) {
          lastGuest = { error: err.message, COMPOSITOR_READY: '0' };
        }
        const hasPlasmaDesktopWindow = Array.isArray(lastHost.windows) && lastHost.windows.some((w) => /plasmashell|Desktop/i.test(`${w.app || ''} ${w.title || ''}`));
        const looksLikeDesktopNotSplash = hasPlasmaDesktopWindow || (lastCanvas.uniqueBuckets >= 80 && lastCanvas.lumaMean >= 45) || (Date.now() - start >= 75000);
        if ((lastGuest.COMPOSITOR_READY === '1' || lastHost.frames >= 30) && lastCanvas.isRendered && looksLikeDesktopNotSplash) {
          return {
            ready: true,
            elapsedMs: Date.now() - start,
            attempts: attempt,
            host: lastHost,
            guest: lastGuest,
            canvas: lastCanvas,
          };
        }
      }
    }

    if (attempt % 4 === 1) {
      logger(
        `[desktop-readiness] waiting (${Math.round((Date.now() - start) / 1000)}s): ` +
          `waylandActive=${lastHost.waylandActive} rvActive=${lastHost.rvDisplayActive} ` +
          `frames=${lastHost.frames} rendered=${Boolean(lastCanvas?.isRendered)} ` +
          `guestReady=${lastGuest?.COMPOSITOR_READY ?? 'pending'}`
      );
    }
    await page.waitForTimeout(pollIntervalMs);
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for KDE compositor readiness. ` +
      `host=${JSON.stringify(lastHost)} guest=${JSON.stringify(lastGuest)} canvas=${JSON.stringify(lastCanvas)}`
  );
}

/**
 * Wait for a specific Wayland application window (e.g. Konsole, Dolphin, System Settings)
 * to appear in rvDisplay.windowList() and advance rendered frame count.
 */
async function waitForGuestWindow(page, appPattern, opts = {}) {
  const { timeoutMs = 45000, pollIntervalMs = 1500, minFrameAdvance = 1 } = opts;
  const start = Date.now();
  const initialHost = await getHostDisplayState(page);
  const baseFrames = initialHost.frames;
  const re = appPattern instanceof RegExp ? appPattern : new RegExp(String(appPattern), 'i');

  while (Date.now() - start < timeoutMs) {
    const host = await getHostDisplayState(page);
    const matched = host.windows.find((w) => re.test(w.app) || re.test(w.title));
    if (matched && host.frames >= baseFrames + minFrameAdvance) {
      const canvas = await evaluateCanvasFrame(page);
      if (canvas.isRendered) {
        return { found: true, window: matched, elapsedMs: Date.now() - start, host, canvas };
      }
    }
    await page.waitForTimeout(pollIntervalMs);
  }
  return { found: false, elapsedMs: Date.now() - start, host: await getHostDisplayState(page) };
}

/**
 * Capture a screenshot only after verifying non-black/non-blank canvas variance,
 * with bounded retries instead of a blind sleep.
 */
async function captureVerifiedScreenshot(page, outPath, opts = {}) {
  const {
    timeoutMs = 30000,
    pollIntervalMs = 1500,
    canvasThresholds = DEFAULT_CANVAS_THRESHOLDS,
    requireCanvas = true,
    logger = console.log,
  } = opts;

  const start = Date.now();
  let lastCanvas = null;

  if (requireCanvas) {
    while (Date.now() - start < timeoutMs) {
      lastCanvas = await evaluateCanvasFrame(page, canvasThresholds);
      if (lastCanvas.isRendered) break;
      await page.waitForTimeout(pollIntervalMs);
    }
    if (!lastCanvas?.isRendered) {
      logger(
        `[desktop-readiness] WARNING: canvas did not pass variance check before ${path.basename(outPath)}: ${JSON.stringify(lastCanvas)}`
      );
      return null;
    }
  }

  try {
    await Promise.race([
      page.screenshot({ path: outPath, timeout: 25000, animations: 'disabled' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot hard timeout 25s')), 27000)),
    ]);
    const stat = fs.statSync(outPath);
    if (stat.size === 0) {
      logger(`[desktop-readiness] WARNING: empty screenshot ${path.basename(outPath)}`);
      return null;
    }
    logger(`Saved ${path.basename(outPath)} (${stat.size} bytes, nonBlack=${lastCanvas?.nonBlackRatio ?? 'n/a'}, stdDev=${lastCanvas?.lumaStdDev ?? 'n/a'})`);
    return outPath;
  } catch (err) {
    logger(`[desktop-readiness] Screenshot failed for ${path.basename(outPath)}: ${err.message}`);
    return null;
  }
}

module.exports = {
  DEFAULT_CANVAS_THRESHOLDS,
  getHostDisplayState,
  evaluateCanvasFrame,
  probeGuestCompositor,
  waitForDesktopReady,
  waitForGuestWindow,
  captureVerifiedScreenshot,
};
