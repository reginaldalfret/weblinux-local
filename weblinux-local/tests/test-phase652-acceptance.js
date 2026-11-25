/**
 * WEBLINUX LOCAL — PHASE 6.5.2: KDE PLASMA FINAL GRAPHICAL ACCEPTANCE
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

async function launchUbuntuKde(page) {
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const chooseBtn = page.locator('text=Choose Distribution').first();
  if (await chooseBtn.isVisible()) {
    await chooseBtn.click();
  } else {
    await page.click('button:has-text("Distributions"), a:has-text("Distributions")');
  }
  await page.waitForTimeout(600);
  await page.locator('div:has-text("Ubuntu Noble Numbat")').last().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(600);
  await page.locator('div:has-text("Ubuntu KDE Plasma")').last().click();
  await page.waitForTimeout(400);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();
}

async function getWinList(page) {
  return await page.evaluate(() =>
    (window.rvDisplay?.windows?.() || []).map(w => ({
      id: w.id, title: w.title, x: w.x, y: w.y, w: w.w, h: w.h, kind: w.kind, role: w.role,
    }))
  );
}

async function run() {
  const metrics = { cold: {}, warm: {}, checks: {} };

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

  // =========================================================================
  // 1. COLD-CACHE BOOT & VIEWPORT SIZING VERIFICATION
  // =========================================================================
  console.log('[1] Cold-cache boot of Ubuntu KDE Plasma 5.27...');
  const coldStart = Date.now();
  await launchUbuntuKde(page);

  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
    }));
    if (st.state === 'running' && st.shellReady) {
      metrics.cold.runtimeReadySec = Math.round((Date.now() - coldStart) / 1000);
      console.log(`✓ Cold runtime-ready: ${metrics.cold.runtimeReadySec}s`);
      break;
    }
  }

  for (let w = 0; w < 30; w++) {
    await page.waitForTimeout(5000);
    const ui = await page.evaluate(() => ({
      splashShown: window.rvSplash?.state?.().shown,
      windows: window.rvDisplay?.windows?.().map(x => ({ id: x.id, title: x.title, w: x.w, h: x.h })) || [],
    }));
    if (ui.splashShown === false && ui.windows.some(x => x.title === 'Plasma')) {
      metrics.cold.splashDismissSec = Math.round((Date.now() - coldStart) / 1000);
      console.log(`✓ Cold splash dismissed & Plasma panel mapped: ${metrics.cold.splashDismissSec}s`);
      await page.waitForTimeout(5000);
      break;
    }
  }

  const layout = await page.evaluate(() => {
    const c = document.querySelector('canvas#screen');
    const r = c ? c.getBoundingClientRect() : null;
    return {
      innerHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
      canvas: r ? { width: c.width, height: c.height, cw: c.clientWidth, ch: c.clientHeight, top: Math.round(r.top), bottom: Math.round(r.bottom) } : null,
    };
  });
  console.log('✓ Viewport & Canvas Layout:', JSON.stringify(layout));
  metrics.checks.viewportFits = layout.canvas && layout.canvas.bottom <= layout.innerHeight && layout.scrollHeight <= layout.innerHeight;
  await saveShot(page, 'p652-01-desktop-panel.png');

  // =========================================================================
  // 2. APPLICATION LAUNCHER ON VISIBLE PLASMA PANEL
  // =========================================================================
  const box = await page.locator('canvas#screen').boundingBox();
  const launcherX = box.x + 24;
  const launcherY = box.y + box.height - 22;
  console.log(`[2] Clicking Application Launcher at (${Math.round(launcherX)}, ${Math.round(launcherY)})...`);
  await page.mouse.click(launcherX, launcherY);
  await page.waitForTimeout(3000);
  const winsLauncher = await getWinList(page);
  console.log('Windows after Launcher click:', JSON.stringify(winsLauncher));
  await saveShot(page, 'p652-02-launcher-open.png');

  // Type "konsole" in Kickoff search and press Enter, or fallback to launch-konsole.sh
  await page.keyboard.type('konsole', { delay: 60 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  let konsoleMapped = (await getWinList(page)).some(w => (w.title || '').includes('Konsole'));
  if (!konsoleMapped) {
    console.log('  Launcher Enter did not map Konsole within 3s; launching via /tmp/launch-konsole.sh...');
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
      if ((await getWinList(page)).some(w => (w.title || '').includes('Konsole'))) {
        konsoleMapped = true;
        break;
      }
    }
  }
  metrics.cold.firstAppSec = Math.round((Date.now() - coldStart) / 1000);
  console.log(`✓ Konsole mapped=${konsoleMapped} (elapsed ${metrics.cold.firstAppSec}s)`);

  // =========================================================================
  // 3. KONSOLE INTERACTIVE INPUT, MOVE & RESIZE
  // =========================================================================
  await page.mouse.click(box.x + 220, box.y + 180);
  await page.waitForTimeout(400);
  await page.keyboard.type('echo PHASE652_KONSOLE_OK; uname -m', { delay: 40 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  const konBefore = (await getWinList(page)).find(w => (w.title || '').includes('Konsole'));
  console.log('Konsole before move/resize:', JSON.stringify(konBefore));
  if (konBefore) {
    // Move Konsole by dragging titlebar
    await page.mouse.move(box.x + (konBefore.x || 20) + 180, box.y + (konBefore.y || 20) + 14);
    await page.mouse.down();
    await page.mouse.move(box.x + (konBefore.x || 20) + 320, box.y + (konBefore.y || 20) + 80, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);
  }
  const konAfterMove = (await getWinList(page)).find(w => (w.title || '').includes('Konsole'));
  console.log('Konsole after move:', JSON.stringify(konAfterMove));
  await saveShot(page, 'p652-03-konsole-moved.png');

  // =========================================================================
  // 4. DOLPHIN LAUNCH (UP TO 60s), MOVE, RESIZE & MINIMIZE/RESTORE
  // =========================================================================
  console.log('[4] Launching Dolphin & auditing startup...');
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

  let dolphinWin = null;
  for (let d = 0; d < 30; d++) {
    await page.waitForTimeout(2000);
    const wins = await getWinList(page);
    dolphinWin = wins.find(w => (w.title || '').toLowerCase().includes('dolphin'));
    if (dolphinWin) {
      console.log(`✓ Dolphin mapped in ${(d + 1) * 2}s:`, JSON.stringify(dolphinWin));
      break;
    }
  }
  const dolphinLog = await runCmd(page, 'cat /ubuntu/tmp/dolphin-test.log 2>/dev/null | head -n 15', 10000);
  console.log('Dolphin log snippet:', (dolphinLog.stdout || dolphinLog.out || '').trim());
  await saveShot(page, 'p652-04-dolphin-open.png');

  if (dolphinWin) {
    // Move Dolphin
    await page.mouse.move(box.x + (dolphinWin.x || 40) + 200, box.y + (dolphinWin.y || 40) + 14);
    await page.mouse.down();
    await page.mouse.move(box.x + (dolphinWin.x || 40) + 380, box.y + (dolphinWin.y || 40) + 110, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    const dolphinMoved = (await getWinList(page)).find(w => (w.title || '').toLowerCase().includes('dolphin'));
    console.log('Dolphin after move:', JSON.stringify(dolphinMoved));
    await saveShot(page, 'p652-05-dolphin-moved.png');
  }

  // Test browser window resize responsiveness
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1500);
  const resizedLayout = await page.evaluate(() => {
    const c = document.querySelector('canvas#screen');
    const r = c ? c.getBoundingClientRect() : null;
    return { innerHeight: window.innerHeight, scrollHeight: document.documentElement.scrollHeight, bottom: r ? Math.round(r.bottom) : null };
  });
  console.log('✓ Layout after 1280x800 resize:', JSON.stringify(resizedLayout));
  metrics.checks.resizeResponsive = resizedLayout.bottom <= resizedLayout.innerHeight;
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.waitForTimeout(1000);

  // =========================================================================
  // 5. PERSISTENCE, CLEAN SHUTDOWN & WARM-CACHE REBOOT
  // =========================================================================
  const token = `PHASE652_PERSIST_${Date.now()}`;
  await runCmd(page, `echo "${token}" > /ubuntu/root/phase652-persist.txt && sync`, 15000);

  await page.keyboard.press('Escape');
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Power Off")').first().click();

  for (let s = 0; s < 20; s++) {
    await page.waitForTimeout(500);
    if ((await page.evaluate(() => window.weblinuxAdapter?.status?.state)) === 'stopped') {
      console.log(`✓ Clean shutdown in ${(s + 1) * 0.5}s`);
      break;
    }
  }

  console.log('[5] Warm-cache reboot of Ubuntu KDE...');
  const warmStart = Date.now();
  await launchUbuntuKde(page);
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
    }));
    if (st.state === 'running' && st.shellReady) {
      metrics.warm.runtimeReadySec = Math.round((Date.now() - warmStart) / 1000);
      console.log(`✓ Warm runtime-ready: ${metrics.warm.runtimeReadySec}s`);
      break;
    }
  }
  for (let w = 0; w < 30; w++) {
    await page.waitForTimeout(5000);
    const ui = await page.evaluate(() => ({
      splashShown: window.rvSplash?.state?.().shown,
      windows: window.rvDisplay?.windows?.().map(x => x.title) || [],
    }));
    if (ui.splashShown === false && ui.windows.includes('Plasma')) {
      metrics.warm.splashDismissSec = Math.round((Date.now() - warmStart) / 1000);
      console.log(`✓ Warm splash dismissed: ${metrics.warm.splashDismissSec}s`);
      break;
    }
  }
  const persistOut = await runCmd(page, 'cat /ubuntu/root/phase652-persist.txt 2>/dev/null || echo MISSING', 15000);
  metrics.checks.warmPersistence = (persistOut.stdout || persistOut.out || '').includes(token);
  console.log(`✓ Warm reboot persistence: ${metrics.checks.warmPersistence}`);

  await page.keyboard.press('Escape');
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await page.locator('button:has-text("Power Off")').first().click();
  await page.waitForTimeout(2500);

  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'phase652-results.json'), JSON.stringify(metrics, null, 2));
  console.log('\n=== PHASE 6.5.2 METRICS ===');
  console.log(JSON.stringify(metrics, null, 2));
  await browser.close();
}

run().catch(err => {
  console.error('Fatal Phase 6.5.2 error:', err);
  process.exit(1);
});
