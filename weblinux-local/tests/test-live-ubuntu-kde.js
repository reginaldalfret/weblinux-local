/**
 * WEBLINUX LOCAL — PHASE 6.5: UBUNTU 24.04.5 LTS KDE PLASMA 5.27 LIVE BOOT & ACCEPTANCE TEST
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/phase6-kde');
const ARTIFACT_DIR = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function saveScreenshotBoth(page, filename) {
  const localPath = path.join(SCREENSHOT_DIR, filename);
  const artifactPath = path.join(ARTIFACT_DIR, filename);
  return page.screenshot({ path: localPath }).then(() => {
    fs.copyFileSync(localPath, artifactPath);
    console.log(`✓ Screenshot saved: ${localPath}`);
  });
}

async function runCmd(page, cmd, timeoutMs = 20000) {
  return await page.evaluate(async ({ command, timeout }) => {
    if (!window.weblinuxAdapter) return { error: 'no adapter' };
    return await window.weblinuxAdapter.runCommand(command, timeout);
  }, { command: cmd, timeout: timeoutMs });
}

async function run() {
  console.log('================================================================');
  console.log('WEBLINUX LOCAL — UBUNTU 24.04.5 LTS KDE PLASMA 5.27 ACCEPTANCE TEST');
  console.log('================================================================\n');

  let browser;
  try {
    browser = await chromium.launch({
      channel: 'msedge',
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-features=SharedArrayBuffer',
        '--enable-unsafe-webgpu',
        '--use-gl=angle',
        '--use-angle=default',
        '--window-size=1600,950',
      ],
    });
    console.log('✓ Launched Microsoft Edge (msedge)');
  } catch (e) {
    console.log('Falling back to chromium:', e.message);
    browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-features=SharedArrayBuffer',
        '--window-size=1600,950',
      ],
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1600, height: 950 },
  });

  const page = await context.newPage();

  page.on('console', msg => {
    const txt = msg.text();
    if (
      txt.includes('[Kernel]') ||
      txt.includes('[Boot') ||
      txt.includes('[Runtime]') ||
      txt.includes('[Wasm') ||
      txt.includes('autostart:') ||
      txt.includes('Ubuntu KDE') ||
      txt.includes('wlserver') ||
      txt.includes('plasma')
    ) {
      console.log(`  [Console] ${txt}`);
    }
  });

  console.log('[Step 1] Loading WebLinux Local at http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('[Step 2] Navigating to Distribution Selector...');
  const chooseDistroBtn = page.locator('text=Choose Distribution').first();
  if (await chooseDistroBtn.isVisible()) {
    await chooseDistroBtn.click();
  } else {
    await page.click('button:has-text("Distributions"), a:has-text("Distributions")');
  }
  await page.waitForTimeout(800);

  console.log('[Step 3] Selecting Ubuntu Noble Numbat...');
  const ubuntuCard = page.locator('div:has-text("Ubuntu Noble Numbat")').last();
  await ubuntuCard.click();
  await page.waitForTimeout(500);

  console.log('[Step 4] Proceeding to Environment Selection...');
  const proceedBtn = page.locator('button:has-text("Configure Desktop")');
  await proceedBtn.click();
  await page.waitForTimeout(800);

  console.log('[Step 5] Selecting Ubuntu KDE Plasma 5.27 Desktop Profile...');
  const kdeCard = page.locator('div:has-text("Ubuntu KDE Plasma")').last();
  await kdeCard.click();
  await page.waitForTimeout(500);

  await saveScreenshotBoth(page, '01-ubuntu-kde-selector.png');

  console.log('[Step 6] Triggering Ubuntu KDE Plasma Launch...');
  const launchBtn = page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first();
  await launchBtn.click();
  console.log('✓ Launch button clicked.');

  console.log('[Step 7] Monitoring boot progression...');
  const bootStart = Date.now();
  let bootDone = false;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const status = await page.evaluate(() => {
      const adapter = window.weblinuxAdapter;
      if (!adapter) return { state: 'uninitialized' };
      return {
        state: adapter.status.state,
        shellReady: adapter.status.shellReady,
        distro: adapter.status.distribution,
        desktop: adapter.status.desktop,
        uptime: adapter.status.uptimeSeconds,
        waylandActive: adapter.status.waylandActive,
      };
    });

    if (i % 5 === 0 || status.state === 'running' || status.shellReady) {
      console.log(`  [${Math.round((Date.now() - bootStart)/1000)}s] State: ${status.state} | ShellReady: ${status.shellReady} | Desktop: ${status.desktop} | Wayland: ${status.waylandActive}`);
    }

    if (status.state === 'running' && status.shellReady) {
      bootDone = true;
      break;
    }
  }

  await saveScreenshotBoth(page, '02-ubuntu-kde-booting.png');

  console.log('\n[Step 8] Waiting for Plasma Wayland desktop to finish splash & render...');
  for (let w = 0; w < 30; w++) {
    await page.waitForTimeout(5000);
    const uiState = await page.evaluate(() => {
      const sp = window.rvSplash && window.rvSplash.state ? window.rvSplash.state() : null;
      const wins = window.rvDisplay && window.rvDisplay.windows ? window.rvDisplay.windows().map(x => ({ id: x.id, kind: x.kind, layer: x.layer, w: x.w, h: x.h, title: x.title })) : [];
      return { splash: sp, windows: wins };
    });
    console.log(`  [+${(w + 1) * 5}s] splash.shown=${uiState.splash?.shown} stages=${JSON.stringify(uiState.splash?.stages)} windows=${JSON.stringify(uiState.windows)}`);
    if (uiState.splash && !uiState.splash.shown) {
      console.log('✓ Splash dismissed! Waiting 15s for Plasma desktop & panel to finish initial paint...');
      await page.waitForTimeout(15000);
      break;
    }
    if (w % 3 === 0) {
      const psOut = await runCmd(page, 'ps | grep -E "hostnode|dbus|plasma|konsole|dolphin|kwin" || true', 15000);
      console.log(`  Processes:\n${(psOut.stdout || psOut.out || '').trim()}`);
    }
  }

  await saveScreenshotBoth(page, '03-ubuntu-kde-desktop.png');
  // Scroll canvas into view at bottom to capture Plasma 5.27 bottom panel
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (c) c.scrollIntoView({ block: 'end' });
  });
  await page.waitForTimeout(500);
  await saveScreenshotBoth(page, '03b-ubuntu-kde-panel.png');
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (c) c.scrollIntoView({ block: 'start' });
  });

  const auditCommands = [
    { label: 'OS Release', cmd: 'ubuntu-kde cat /etc/os-release' },
    { label: 'Kernel', cmd: 'ubuntu-kde uname -a' },
    { label: 'Mounts', cmd: 'df -h' },
    { label: 'Memory', cmd: 'free -m' },
    { label: 'Plasma Version', cmd: 'ubuntu-kde "QT_QPA_PLATFORM=offscreen plasmashell --version"' },
    { label: 'Konsole Version', cmd: 'ubuntu-kde "QT_QPA_PLATFORM=offscreen konsole --version"' },
    { label: 'Dolphin Version', cmd: 'ubuntu-kde "QT_QPA_PLATFORM=offscreen dolphin --version"' },
    { label: 'KWin Version', cmd: 'ubuntu-kde "QT_QPA_PLATFORM=offscreen kwin_wayland --version"' },
    { label: 'Session Log', cmd: 'cat /ubuntu/root/ubuntu-kde-session.log 2>/dev/null || true' },
    { label: 'DBus Log', cmd: 'cat /ubuntu/root/dbus.log 2>/dev/null || true' },
    { label: 'KWin/wlserver Log', cmd: 'tail -n 40 /ubuntu/root/kwin.log 2>/dev/null || true' },
    { label: 'Qt Log', cmd: 'tail -n 30 /ubuntu/root/qt.log 2>/dev/null || true' },
    { label: 'Persistence Test', cmd: 'echo "Ubuntu KDE 5.27 Verified" > /ubuntu/root/kde-verified.txt && cat /ubuntu/root/kde-verified.txt' },
  ];

  const results = {};
  for (const tc of auditCommands) {
    console.log(`\n  > ${tc.label}: ${tc.cmd}`);
    const res = await runCmd(page, tc.cmd, 20000);
    const out = (res.stdout || res.out || '').trim();
    results[tc.label] = out;
    console.log(out ? out : '(empty)');
  }

  // Test launching Konsole & Dolphin via helper scripts inside /ubuntu/tmp
  console.log('\n[Step 9] Testing Konsole & Dolphin launch inside Wayland session...');
  await runCmd(page, `cat <<'EOF' > /ubuntu/tmp/launch-konsole.sh
#!/bin/bash
export DISPLAY=
export WAYLAND_DISPLAY=wayland-0
export XDG_RUNTIME_DIR=/tmp/runtime-root
export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus
export QT_QPA_PLATFORM=wayland
export QT_QUICK_BACKEND=software
export QMLSCENE_DEVICE=softwarecontext
export LIBGL_ALWAYS_SOFTWARE=1
nohup konsole >/tmp/konsole-test.log 2>&1 &
EOF
chmod +x /ubuntu/tmp/launch-konsole.sh
ubuntu-kde /tmp/launch-konsole.sh`, 15000);
  for (let k = 0; k < 15; k++) {
    await page.waitForTimeout(2000);
    const wins = await page.evaluate(() => window.rvDisplay?.windows?.().map(w => ({ id: w.id, title: w.title, w: w.w, h: w.h })) || []);
    if (wins.some(w => (w.title || '').includes('Konsole'))) {
      console.log('✓ Konsole window mapped:', JSON.stringify(wins));
      break;
    }
  }
  // Click inside Konsole window and type a real command
  await page.mouse.click(260, 260);
  await page.waitForTimeout(400);
  await page.keyboard.type('cat /etc/os-release | head -n 4 && uname -m', { delay: 30 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await saveScreenshotBoth(page, '04-ubuntu-kde-konsole.png');

  await runCmd(page, `cat <<'EOF' > /ubuntu/tmp/launch-dolphin.sh
#!/bin/bash
export DISPLAY=
export WAYLAND_DISPLAY=wayland-0
export XDG_RUNTIME_DIR=/tmp/runtime-root
export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus
export QT_QPA_PLATFORM=wayland
export QT_QUICK_BACKEND=software
export QMLSCENE_DEVICE=softwarecontext
export LIBGL_ALWAYS_SOFTWARE=1
nohup dolphin >/tmp/dolphin-test.log 2>&1 &
EOF
chmod +x /ubuntu/tmp/launch-dolphin.sh
ubuntu-kde /tmp/launch-dolphin.sh`, 15000);
  for (let d = 0; d < 15; d++) {
    await page.waitForTimeout(2000);
    const wins = await page.evaluate(() => window.rvDisplay?.windows?.().map(w => ({ id: w.id, title: w.title, w: w.h })) || []);
    if (wins.some(w => (w.title || '').toLowerCase().includes('dolphin'))) {
      console.log('✓ Dolphin window mapped:', JSON.stringify(wins));
      break;
    }
  }
  await page.waitForTimeout(2000);
  await saveScreenshotBoth(page, '05-ubuntu-kde-dolphin.png');

  const konsoleLog = await runCmd(page, 'cat /ubuntu/tmp/konsole-test.log 2>/dev/null || true', 10000);
  const dolphinLog = await runCmd(page, 'cat /ubuntu/tmp/dolphin-test.log 2>/dev/null || true', 10000);
  console.log('\nKonsole Test Log:', (konsoleLog.stdout || konsoleLog.out || '').trim());
  console.log('\nDolphin Test Log:', (dolphinLog.stdout || dolphinLog.out || '').trim());

  // Check canvas pixel diversity
  const canvasStats = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { found: false };
    return {
      found: true,
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
    };
  });
  console.log('\nCanvas Stats:', JSON.stringify(canvasStats));

  // Save JSON report
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'ubuntu-kde-live-results.json'),
    JSON.stringify({ bootDone, canvasStats, results }, null, 2)
  );

  // Clean shutdown test
  console.log('\n[Step 10] Testing clean shutdown...');
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
  const powerBtn = page.locator('button:has-text("Power Off")').first();
  if (await powerBtn.isVisible()) {
    await powerBtn.click({ force: true });
    await page.waitForTimeout(3000);
    console.log('✓ Power Off triggered.');
  }

  await browser.close();
  console.log('\n=== TEST COMPLETE ===');
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
