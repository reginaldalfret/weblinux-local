#!/usr/bin/env node
/**
 * Phase 14 — Live Native Browser Qualification & Persistence Test
 * Usage: node tests/test-phase14-browser.js <distroId>
 * Supported distroIds:
 *   debian-firefox, ubuntu-kde-epiphany, arch-kde, opensuse-tumbleweed-kde, alpine-kde
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DISTRO_CONFIGS = {
  'debian-firefox': {
    selectorText: 'Debian GNU/Linux 13 (Trixie) + Epiphany Web',
    chrootCmd: 'debian',
    rootMount: '/debian',
    browserName: 'Epiphany',
    binaryCandidates: ['/usr/bin/epiphany'],
    wrapperPath: '/usr/local/bin/weblinux-browser',
    browserHome: '/root/browser-home',
    plasmaWaitMs: 95000,
    browserWaitMs: 45000,
  },
  'ubuntu-kde-epiphany': {
    selectorText: 'Ubuntu 24.04.5 LTS KDE + Epiphany Web',
    chrootCmd: 'ubuntu-kde',
    rootMount: '/ubuntu',
    browserName: 'Epiphany',
    binaryCandidates: ['/usr/bin/epiphany'],
    wrapperPath: '/usr/local/bin/weblinux-browser',
    browserHome: '/home/ubuntu',
    plasmaWaitMs: 95000,
    browserWaitMs: 45000,
  },
  'arch-kde': {
    selectorText: 'Arch Linux RISC-V (Community Port + KDE Plasma 6)',
    chrootCmd: 'arch-root',
    rootMount: '/arch',
    browserName: 'Chromium',
    binaryCandidates: ['/usr/bin/chromium', '/usr/lib/chromium/chromium'],
    wrapperPath: '/usr/local/bin/weblinux-browser',
    browserHome: '/root/browser-home',
    plasmaWaitMs: 110000,
    browserWaitMs: 60000,
  },
  'opensuse-tumbleweed-kde': {
    selectorText: 'openSUSE Tumbleweed RISC-V (KDE Plasma 6)',
    chrootCmd: 'opensuse-root',
    rootMount: '/opensuse',
    browserName: 'Epiphany',
    binaryCandidates: ['/usr/bin/epiphany'],
    wrapperPath: '/usr/local/bin/weblinux-browser',
    browserHome: '/root/browser-home',
    plasmaWaitMs: 110000,
    browserWaitMs: 45000,
  },
  'alpine-kde': {
    selectorText: 'Alpine Linux',
    chrootCmd: 'alpine-root',
    rootMount: '/alpine',
    browserName: 'Epiphany',
    binaryCandidates: ['/usr/bin/epiphany'],
    wrapperPath: '/usr/local/bin/weblinux-browser',
    browserHome: '/root/browser-home',
    plasmaWaitMs: 120000,
    browserWaitMs: 45000,
  },
};

const distroId = process.argv[2];
if (!distroId || !DISTRO_CONFIGS[distroId]) {
  console.error('Usage: node tests/test-phase14-browser.js <distroId>');
  console.error('Valid distroIds:', Object.keys(DISTRO_CONFIGS).join(', '));
  process.exit(1);
}

const cfg = DISTRO_CONFIGS[distroId];
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'phase14');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const PROFILE_DIR = path.join(__dirname, '..', `.tmp-edge-p14-${distroId}`);

async function waitForBoot(page, timeoutSec = 240) {
  for (let i = 0; i < timeoutSec; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
      waylandActive: window.weblinuxAdapter?.status?.waylandActive,
      error: window.weblinuxAdapter?.status?.error,
    }));
    if (st.error) {
      throw new Error('Boot error: ' + st.error);
    }
    if (st.state === 'running' && st.shellReady) return st;
  }
  const st = await page.evaluate(() => ({
    state: window.weblinuxAdapter?.status?.state,
    shellReady: window.weblinuxAdapter?.status?.shellReady,
    waylandActive: window.weblinuxAdapter?.status?.waylandActive,
    error: window.weblinuxAdapter?.status?.error,
  }));
  const adapterLogs = await page.evaluate(() => (window.weblinuxAdapter?.logs || []).slice(-40));
  console.error('ADAPTER_LOGS:\n' + adapterLogs.join('\n'));
  if (st.shellReady) {
    const diag = await page.evaluate(async () => {
      return await window.weblinuxAdapter.runCommand('cat /proc/partitions; dmesg | grep -iE "wd|blk|wasm" | tail -n 20', 10000);
    }).catch((e) => ({ output: e.message }));
    console.error('BOOT_TIMEOUT_DIAG:', diag.stdout || diag.output || '');
  }
  throw new Error('Timed out waiting for guest shellReady: ' + JSON.stringify(st));
}

async function selectAndLaunch(page) {
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(600);
  await page.locator(`div:has-text("${cfg.selectorText}")`).last().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(500);
  if (cfg.desktopText) {
    const dLoc = page.locator(`div:has-text("${cfg.desktopText}")`).first();
    if (await dLoc.isVisible()) {
      await dLoc.click();
      await page.waitForTimeout(300);
    }
  }
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();
  return await waitForBoot(page, 150);
}

async function safeScreenshot(page, outPath) {
  console.log(`Capturing screenshot ${path.basename(outPath)}...`);
  try {
    await Promise.race([
      page.screenshot({ path: outPath, timeout: 20000, animations: 'disabled' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot hard timeout 20s')), 22000)),
    ]);
    console.log(`Saved ${path.basename(outPath)}`);
    return outPath;
  } catch (err) {
    console.warn(`Screenshot failed for ${path.basename(outPath)}: ${err.message}`);
    return null;
  }
}

async function runGuest(page, innerCmd, timeoutMs = 45000) {
  const b64 = Buffer.from(innerCmd, 'utf8').toString('base64');
  const parts = b64.match(/.{1,120}/g) || [];
  await page.evaluate(
    async ({ rootMount, parts }) => {
      await window.weblinuxAdapter.runCommand(`rm -f ${rootMount}/tmp/p14cmd.b64 ${rootMount}/tmp/p14cmd.sh`, 10000);
      for (const part of parts) {
        await window.weblinuxAdapter.runCommand(`printf %s ${part} >> ${rootMount}/tmp/p14cmd.b64`, 10000);
      }
      await window.weblinuxAdapter.runCommand(`base64 -d ${rootMount}/tmp/p14cmd.b64 > ${rootMount}/tmp/p14cmd.sh && chmod +x ${rootMount}/tmp/p14cmd.sh`, 10000);
    },
    { rootMount: cfg.rootMount, parts }
  );
  const res = await page.evaluate(
    async ({ cmd, t }) => {
      return await Promise.race([
        window.weblinuxAdapter.runCommand(cmd, t),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`runCommand hard timeout ${t}ms`)), t + 5000)),
      ]);
    },
    { cmd: `${cfg.chrootCmd} /bin/sh /tmp/p14cmd.sh`, t: timeoutMs }
  );
  return (res.stdout || res.output || '').trim();
}

(async () => {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const result = {
    distroId,
    browserName: cfg.browserName,
    timestamp: new Date().toISOString(),
    coldBootSec: null,
    warmReloadBootSec: null,
    elfAndVersion: '',
    networkCheck: '',
    launchOut: '',
    processAndMemory: '',
    persistenceCheck: '',
    screenshots: [],
    status: 'FAILED',
    error: null,
  };

  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: 'msedge',
      headless: false,
      viewport: { width: 1400, height: 900 },
      args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
    });
    const page = ctx.pages()[0] || (await ctx.newPage());
    page.on('pageerror', (err) => console.error('PAGEERROR:', err.message));
    page.on('console', (msg) => {
      const t = msg.text();
      if (msg.type() === 'error' || msg.type() === 'warning' || t.includes('integrity') || t.includes('OPFS') || t.includes('disk') || t.includes('Storage')) {
        console.log('BROWSER_CONSOLE:', msg.type(), t);
      }
    });

    console.log(`[${distroId}] 1. Cold booting...`);
    const t0 = Date.now();
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await selectAndLaunch(page);
    result.coldBootSec = Number(((Date.now() - t0) / 1000).toFixed(1));
    console.log(`[${distroId}] Booted in ${result.coldBootSec}s`);

    // Step 2: Inspect browser binary, ELF header, version, user, wrapper
    const inspectScript = `
      echo "=== OS ==="
      grep PRETTY_NAME /etc/os-release || cat /etc/alpine-release
      echo "=== WRAPPER ==="
      ls -la ${cfg.wrapperPath} 2>&1 || true
      id browser 2>&1 || true
      echo "=== BINARY ==="
      for b in ${cfg.binaryCandidates.join(' ')}; do
        if [ -e "$b" ]; then
          ls -la "$b"
          readelf -h "$b" 2>/dev/null | grep -E "Class:|Machine:" || file -L "$b" 2>/dev/null || true
          "$b" --version 2>&1 | head -n 3 || true
          break
        fi
      done
    `;
    result.elfAndVersion = await runGuest(page, inspectScript, 30000);
    console.log(`[${distroId}] 2. Binary & Version:\n${result.elfAndVersion}`);

    // Step 3: Network & TLS & RFC1918 block
    const netScript = `
      echo "=== DNS_HTTPS ==="
      getent hosts example.com 2>&1 || true
      curl -sI --max-time 12 https://example.com 2>&1 | head -n 4 || true
      echo "=== RFC1918 ==="
      curl -s --max-time 4 http://192.168.1.1 >/dev/null 2>&1 && echo "RFC1918_FAIL" || echo "RFC1918_BLOCKED_OK"
    `;
    result.networkCheck = await runGuest(page, netScript, 30000);
    console.log(`[${distroId}] 3. Network:\n${result.networkCheck}`);

    // Step 4: Wait for Plasma Wayland desktop
    console.log(`[${distroId}] 4. Waiting ${cfg.plasmaWaitMs / 1000}s for Plasma Wayland desktop...`);
    await page.waitForTimeout(cfg.plasmaWaitMs);

    // Create local JS/CSS/Canvas test page + download verification file
    const launchScript = `
      cat <<'HTML' > /tmp/p14-test.html
<!DOCTYPE html>
<html>
<head><title>WebLinux Phase 14 Browser Test</title></head>
<body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;padding:24px">
  <h1>WebLinux Phase 14 (${distroId})</h1>
  <div id="js-status">JS_PENDING</div>
  <canvas id="c" width="360" height="80" style="margin-top:12px;border:1px solid #38bdf8"></canvas>
  <script>
    document.getElementById('js-status').textContent = 'JS_OK: ' + navigator.userAgent;
    const ctx = document.getElementById('c').getContext('2d');
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, 0, 360, 80);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('HTML_CSS_JS_CANVAS_OK', 36, 48);
  </script>
</body>
</html>
HTML
      chmod 644 /tmp/p14-test.html
      mkdir -p ${cfg.browserHome}/Downloads ${cfg.browserHome}/.config
      echo "PHASE14_PERSIST_${distroId}" > ${cfg.browserHome}/.config/p14-profile-marker.txt
      curl -sL --max-time 12 https://example.com -o ${cfg.browserHome}/Downloads/example.html || true
      sha256sum ${cfg.browserHome}/Downloads/example.html ${cfg.browserHome}/.config/p14-profile-marker.txt > /tmp/p14-sha.txt 2>&1 || true
      cat /tmp/p14-sha.txt
      if [ -x "${cfg.wrapperPath}" ]; then
        chown -R browser:browser ${cfg.browserHome} 2>/dev/null || true
        (${cfg.wrapperPath} https://example.com >/tmp/p14-browser.log 2>&1 </dev/null &)
        echo "LAUNCHED_WRAPPER"
      else
        export GDK_BACKEND=wayland WAYLAND_DISPLAY=wayland-0
        export XDG_RUNTIME_DIR=/tmp/runtime-root
        [ -d /tmp/runtime-ubuntu ] && export XDG_RUNTIME_DIR=/tmp/runtime-ubuntu
        export DBUS_SESSION_BUS_ADDRESS="unix:path=\${XDG_RUNTIME_DIR}/bus"
        export WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 JSC_useJIT=0
        export WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1
        (epiphany https://example.com >/tmp/p14-browser.log 2>&1 </dev/null &)
        echo "LAUNCHED_EPIPHANY_FALLBACK"
      fi
    `;
    result.launchOut = await runGuest(page, launchScript, 45000);
    console.log(`[${distroId}] 5. Launch:\n${result.launchOut}`);

    console.log(`[${distroId}] 6. Waiting ${cfg.browserWaitMs / 1000}s for browser render...`);
    await page.waitForTimeout(cfg.browserWaitMs);

    const procScript = `
      echo "=== PROCS ==="
      ps -ef | grep -iE "chromium|epiphany|WebKit" | grep -v grep || true
      echo "=== MEMORY ==="
      free -m
      echo "=== BROWSER_LOG ==="
      tail -n 20 /tmp/p14-browser.log 2>&1 || true
    `;
    result.processAndMemory = await runGuest(page, procScript, 30000);
    console.log(`[${distroId}] 7. Process & Memory:\n${result.processAndMemory}`);

    const shot1 = path.join(SCREENSHOT_DIR, `p14-${distroId}-example.png`);
    if (await safeScreenshot(page, shot1)) result.screenshots.push(shot1);

    // Step 8: Persistence via shutdown + page.reload()
    console.log(`[${distroId}] 8. Testing OPFS persistence across shutdown + page.reload()...`);
    await runGuest(page, 'sync', 15000);
    await page.evaluate(async () => {
      if (window.weblinuxAdapter?.shutdown) await window.weblinuxAdapter.shutdown();
    });
    await page.waitForTimeout(2000);

    const t1 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await selectAndLaunch(page);
    result.warmReloadBootSec = Number(((Date.now() - t1) / 1000).toFixed(1));

    const persistScript = `
      echo "=== PERSIST_CHECK ==="
      ls -la ${cfg.browserHome}/.config/p14-profile-marker.txt ${cfg.browserHome}/Downloads/example.html 2>&1 || true
      cat ${cfg.browserHome}/.config/p14-profile-marker.txt 2>&1 || true
      sha256sum ${cfg.browserHome}/Downloads/example.html ${cfg.browserHome}/.config/p14-profile-marker.txt 2>&1 || true
    `;
    result.persistenceCheck = await runGuest(page, persistScript, 30000);
    console.log(`[${distroId}] 9. Persistence (${result.warmReloadBootSec}s reload):\n${result.persistenceCheck}`);

    const shot2 = path.join(SCREENSHOT_DIR, `p14-${distroId}-persisted.png`);
    if (await safeScreenshot(page, shot2)) result.screenshots.push(shot2);

    const hasMarker = result.persistenceCheck.includes(`PHASE14_PERSIST_${distroId}`);
    const hasNet = result.networkCheck.includes('HTTP/') && result.networkCheck.includes('RFC1918_BLOCKED_OK');
    result.status = hasMarker && hasNet ? 'PASS' : 'PARTIAL';
  } catch (err) {
    result.error = err.message || String(err);
    console.error(`[${distroId}] ERROR:`, result.error);
  } finally {
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, `p14-${distroId}-result.json`),
      JSON.stringify(result, null, 2)
    );
    if (ctx) {
      await ctx.close().catch(() => {});
    }
  }
})();
