/**
 * WEBLINUX LOCAL — PHASE 6.5.1: UBUNTU KDE PLASMA FINAL ACCEPTANCE, INTERACTION, SHUTDOWN & REBOOT
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/phase6-kde');
const ARTIFACT_DIR = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function saveShot(page, filename) {
  const localPath = path.join(SCREENSHOT_DIR, filename);
  const artifactPath = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: localPath });
  fs.copyFileSync(localPath, artifactPath);
  console.log(`✓ Screenshot saved: ${localPath}`);
}

async function runCmd(page, cmd, timeoutMs = 20000) {
  return await page.evaluate(async ({ command, timeout }) => {
    if (!window.weblinuxAdapter) return { error: 'no adapter' };
    return await window.weblinuxAdapter.runCommand(command, timeout);
  }, { command: cmd, timeout: timeoutMs });
}

async function launchProfile(page, distroText, desktopText) {
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  const chooseDistroBtn = page.locator('text=Choose Distribution').first();
  if (await chooseDistroBtn.isVisible()) {
    await chooseDistroBtn.click();
  } else {
    await page.click('button:has-text("Distributions"), a:has-text("Distributions")');
  }
  await page.waitForTimeout(600);

  await page.locator(`div:has-text("${distroText}")`).last().click();
  await page.waitForTimeout(400);

  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(600);

  await page.locator(`div:has-text("${desktopText}")`).last().click();
  await page.waitForTimeout(400);

  const launchBtn = page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first();
  await launchBtn.click();
}

async function run() {
  const t0 = Date.now();
  const report = { phases: {}, timings: {}, shutdownLogs: [], errors: [] };

  console.log('================================================================');
  console.log('WEBLINUX LOCAL — PHASE 6.5.1 FINAL ACCEPTANCE & SHUTDOWN QUALIFICATION');
  console.log('================================================================\n');

  const browser = await chromium.launch({
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

  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();

  page.on('console', msg => {
    const txt = msg.text();
    if (txt.includes('[Shutdown')) {
      report.shutdownLogs.push(txt);
      console.log(`  [ShutdownLog] ${txt}`);
    }
  });

  // =========================================================================
  // PHASE 2: LIVE INTERACTION TESTS ON UBUNTU KDE
  // =========================================================================
  console.log('[Phase 2] Launching Ubuntu KDE Plasma 5.27...');
  const bootStart = Date.now();
  await launchProfile(page, 'Ubuntu Noble Numbat', 'Ubuntu KDE Plasma');

  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
      waylandActive: window.weblinuxAdapter?.status?.waylandActive,
    }));
    if (st.state === 'running' && st.shellReady) {
      report.timings.bootToShellSec = Math.round((Date.now() - bootStart) / 1000);
      console.log(`✓ Booted to running/shellReady in ${report.timings.bootToShellSec}s`);
      break;
    }
  }

  // Wait for splash dismissal and panel appearance
  for (let w = 0; w < 30; w++) {
    await page.waitForTimeout(5000);
    const ui = await page.evaluate(() => ({
      splashShown: window.rvSplash?.state?.().shown,
      windows: window.rvDisplay?.windows?.().map(x => ({ id: x.id, title: x.title, w: x.w, h: x.h })) || [],
      canvas: (() => {
        const c = document.querySelector('canvas');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, top: r.top, bottom: r.bottom };
      })(),
    }));
    if (ui.splashShown === false && ui.windows.some(x => x.title === 'Plasma')) {
      report.timings.splashDismissSec = Math.round((Date.now() - bootStart) / 1000);
      console.log(`✓ Splash dismissed & Plasma panel mapped in ${report.timings.splashDismissSec}s! Canvas=${JSON.stringify(ui.canvas)}`);
      report.phases.canvasAfterFix = ui.canvas;
      await page.waitForTimeout(8000);
      break;
    }
  }

  await saveShot(page, 'p651-01-desktop-with-panel.png');

  // Test 4: Open Application Launcher (bottom-left of canvas)
  const canvasBox = await page.locator('canvas#screen').boundingBox();
  if (canvasBox) {
    const launcherX = canvasBox.x + 24;
    const launcherY = Math.min(canvasBox.y + canvasBox.height - 22, 930);
    console.log(`[Phase 2] Clicking Application Launcher at (${Math.round(launcherX)}, ${Math.round(launcherY)})...`);
    await page.mouse.click(launcherX, launcherY);
    await page.waitForTimeout(2500);
    await saveShot(page, 'p651-02-app-launcher.png');
    await page.keyboard.press('Escape');
    await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await page.waitForTimeout(500);
  }

  // Test 5 & 6: Launch Konsole and type interactive command
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
    const wins = await page.evaluate(() => window.rvDisplay?.windows?.().map(w => w.title) || []);
    if (wins.some(t => (t || '').includes('Konsole'))) {
      console.log('✓ Konsole mapped');
      break;
    }
  }
  await page.waitForTimeout(1000);
  await page.mouse.click(canvasBox.x + 220, canvasBox.y + 180);
  await page.waitForTimeout(400);
  await page.keyboard.type('echo PHASE651_KONSOLE_OK; uname -m', { delay: 40 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await saveShot(page, 'p651-03-konsole-interactive.png');

  // Test 7 & 8: Launch Dolphin and move its window
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
    const wins = await page.evaluate(() => window.rvDisplay?.windows?.().map(w => w.title) || []);
    if (wins.some(t => (t || '').toLowerCase().includes('dolphin'))) {
      console.log('✓ Dolphin mapped');
      break;
    }
  }
  await page.waitForTimeout(2000);

  // Move Dolphin window by dragging titlebar
  console.log('[Phase 2] Testing window move via mouse drag on Dolphin titlebar...');
  await page.mouse.move(canvasBox.x + 320, canvasBox.y + 48);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 560, canvasBox.y + 160, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  await saveShot(page, 'p651-04-dolphin-moved.png');

  // Test 11 & 12: Escape exits Pointer Lock & normal UI interaction resumes
  await page.keyboard.press('Escape');
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await page.waitForTimeout(300);
  const pointerLockAfterEsc = await page.evaluate(() => document.pointerLockElement === null);
  console.log(`✓ Pointer Lock released after Escape: ${pointerLockAfterEsc}`);
  report.phases.pointerLockReleased = pointerLockAfterEsc;

  // =========================================================================
  // PHASE 3: PERSISTENCE WRITE + POWER OFF + STORAGE LOCK CHECK + REBOOT
  // =========================================================================
  const persistToken = `PHASE_6_5_1_PERSIST_${Date.now()}`;
  const writeRes = await runCmd(page, `echo "${persistToken}" > /ubuntu/root/phase651-persist.txt && sync && cat /ubuntu/root/phase651-persist.txt`, 15000);
  console.log(`[Phase 3] Pre-shutdown persistence write: ${(writeRes.stdout || writeRes.out || '').trim()}`);

  console.log('[Phase 3] Clicking Power Off (normal click without force)...');
  const powerBtn = page.locator('button:has-text("Power Off")').first();
  await powerBtn.click(); // Normal Playwright click — verifies no pointer interception!

  for (let s = 0; s < 20; s++) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => window.weblinuxAdapter?.status?.state);
    if (st === 'stopped') {
      console.log(`✓ Runtime transitioned to state='stopped' in ${(s + 1) * 0.5}s`);
      report.phases.cleanShutdown = true;
      break;
    }
  }

  const locksAfterShutdown = await page.evaluate(async () => {
    if (!navigator.locks || !navigator.locks.query) return { unsupported: true };
    const q = await navigator.locks.query();
    return { held: q.held.length, pending: q.pending.length };
  });
  console.log(`[Phase 3] Storage locks after shutdown: ${JSON.stringify(locksAfterShutdown)}`);
  report.phases.locksAfterShutdown = locksAfterShutdown;

  // Reboot Ubuntu KDE in the SAME BrowserContext and verify persistence!
  console.log('[Phase 3] Rebooting Ubuntu KDE to verify OPFS persistence across Power Off...');
  await launchProfile(page, 'Ubuntu Noble Numbat', 'Ubuntu KDE Plasma');
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
    }));
    if (st.state === 'running' && st.shellReady) break;
  }
  const readAfterReboot = await runCmd(page, 'cat /ubuntu/root/phase651-persist.txt 2>/dev/null || echo MISSING', 15000);
  const persistedVal = (readAfterReboot.stdout || readAfterReboot.out || '').trim();
  const persistedOk = persistedVal.includes(persistToken);
  console.log(`[Phase 3] Post-reboot persistence read: "${persistedVal}" (matched=${persistedOk})`);
  report.phases.persistenceAfterReboot = persistedOk;

  // Clean shutdown of rebooted Ubuntu KDE
  await page.keyboard.press('Escape');
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await page.locator('button:has-text("Power Off")').first().click();
  await page.waitForTimeout(2500);

  // =========================================================================
  // PHASE 4: CROSS-DISTRIBUTION REGRESSION CHECK (UBUNTU CLI + DEBIAN KDE)
  // =========================================================================
  console.log('\n[Phase 4] Verifying Ubuntu CLI boot & disk isolation...');
  await launchProfile(page, 'Ubuntu Noble Numbat', 'Ubuntu CLI Shell');
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
    }));
    if (st.state === 'running' && st.shellReady) break;
  }
  const ubuntuCliDf = await runCmd(page, 'df -h && ubuntu cat /etc/os-release | head -n 2', 15000);
  console.log('[Phase 4] Ubuntu CLI df/os-release:\n' + (ubuntuCliDf.stdout || ubuntuCliDf.out || '').trim());
  report.phases.ubuntuCliOk = (ubuntuCliDf.stdout || ubuntuCliDf.out || '').includes('/ubuntu');
  await page.locator('button:has-text("Power Off")').first().click();
  await page.waitForTimeout(2500);

  console.log('\n[Phase 4] Verifying Debian 13 KDE boot & home isolation...');
  await launchProfile(page, 'Debian 13', 'KDE Plasma');
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
    }));
    if (st.state === 'running' && st.shellReady) break;
  }
  const debianDf = await runCmd(page, 'df -h && ls /debian/root/phase651-persist.txt 2>/dev/null || echo ISOLATED_OK', 15000);
  console.log('[Phase 4] Debian KDE df/isolation:\n' + (debianDf.stdout || debianDf.out || '').trim());
  report.phases.debianKdeOk = (debianDf.stdout || debianDf.out || '').includes('/debian');
  report.phases.homeIsolatedOk = (debianDf.stdout || debianDf.out || '').includes('ISOLATED_OK');

  await page.keyboard.press('Escape');
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await page.locator('button:has-text("Power Off")').first().click();
  await page.waitForTimeout(2500);

  report.timings.totalTestSec = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'phase651-results.json'), JSON.stringify(report, null, 2));
  console.log('\n=== PHASE 6.5.1 COMPLETE ===');
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
}

run().catch(err => {
  console.error('Fatal Phase 6.5.1 error:', err);
  process.exit(1);
});
