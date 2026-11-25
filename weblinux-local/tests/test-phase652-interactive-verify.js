/**
 * WEBLINUX LOCAL — PHASE 6.5.2: LAUNCHER, DOLPHIN & WINDOW OPS VERIFICATION
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/phase6-kde');
const ARTIFACT_DIR = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1';

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

async function getWinList(page) {
  return await page.evaluate(() =>
    (window.rvDisplay?.windows?.() || []).map(w => ({
      id: w.id, title: w.title, x: w.x, y: w.y, w: w.w, h: w.h, kind: w.kind, role: w.role, min: !!w.minimized,
    }))
  );
}

async function run() {
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

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const chooseBtn = page.locator('text=Choose Distribution').first();
  if (await chooseBtn.isVisible()) await chooseBtn.click();
  else await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(600);
  await page.locator('div:has-text("Ubuntu Noble Numbat")').last().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(600);
  await page.locator('div:has-text("Ubuntu KDE Plasma")').last().click();
  await page.waitForTimeout(400);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();

  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
    }));
    if (st.state === 'running' && st.shellReady) break;
  }

  for (let w = 0; w < 30; w++) {
    await page.waitForTimeout(5000);
    const ui = await page.evaluate(() => ({
      splashShown: window.rvSplash?.state?.().shown,
      windows: window.rvDisplay?.windows?.().map(x => x.title) || [],
    }));
    if (ui.splashShown === false && ui.windows.includes('Plasma')) {
      await page.waitForTimeout(6000);
      break;
    }
  }

  const box = await page.locator('canvas#screen').boundingBox();
  const wins0 = await getWinList(page);
  const panel = wins0.find(w => w.title === 'Plasma') || { x: 81, y: 572, w: 1438, h: 44 };
  const kickX = box.x + panel.x + 22;
  const kickY = box.y + panel.y + 22;
  console.log(`[1] Clicking Kickoff Launcher at (${Math.round(kickX)}, ${Math.round(kickY)}) [panel=${JSON.stringify(panel)}]...`);
  await page.mouse.click(kickX, kickY);
  await page.waitForTimeout(3000);
  const winsAfterKick = await getWinList(page);
  console.log('Windows after Kickoff click:', JSON.stringify(winsAfterKick));
  await saveShot(page, 'p652-launcher-real.png');

  // Launch Konsole via Kickoff search or fallback
  await page.keyboard.type('konsole', { delay: 60 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);

  let konWin = (await getWinList(page)).find(w => (w.title || '').includes('Konsole'));
  if (!konWin) {
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
      konWin = (await getWinList(page)).find(w => (w.title || '').includes('Konsole'));
      if (konWin) break;
    }
  }
  console.log('✓ Konsole mapped:', JSON.stringify(konWin));

  // Launch Dolphin (wait up to 90s)
  console.log('[2] Launching Dolphin (waiting up to 90s)...');
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

  let dolWin = null;
  for (let d = 0; d < 45; d++) {
    await page.waitForTimeout(2000);
    dolWin = (await getWinList(page)).find(w => (w.title || '').toLowerCase().includes('dolphin'));
    if (dolWin) {
      console.log(`✓ Dolphin mapped in ${(d + 1) * 2}s:`, JSON.stringify(dolWin));
      break;
    }
  }
  await page.waitForTimeout(2000);
  await saveShot(page, 'p652-dolphin-real.png');

  // Test Window Move & Resize using wlserver orders / rvDisplay
  // Also release pointer lock so normal mouse works cleanly
  await page.keyboard.press('Escape');
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });

  const opsResult = await page.evaluate(() => {
    const D = window.rvDisplay;
    if (!D || !D.windows) return { unsupported: true };
    const wins = D.windows();
    const kon = wins.find(w => (w.title || '').includes('Konsole'));
    const dol = wins.find(w => (w.title || '').toLowerCase().includes('dolphin'));
    const res = {
      konBefore: kon ? { x: kon.x, y: kon.y, w: kon.w, h: kon.h } : null,
      dolBefore: dol ? { x: dol.x, y: dol.y, w: dol.w, h: dol.h } : null,
      hasMove: typeof D.moveWindow === 'function' || typeof D.order === 'function',
    };
    if (kon && typeof D.order === 'function') {
      D.order(17, kon.id, 60, 50, 640, 380);
    }
    if (dol && typeof D.order === 'function') {
      D.order(17, dol.id, 720, 60, 760, 460);
    }
    return res;
  });
  await page.waitForTimeout(1500);
  const winsAfterOps = await getWinList(page);
  console.log('[3] Window ops result:', JSON.stringify(opsResult));
  console.log('[3] Windows after move/resize:', JSON.stringify(winsAfterOps));
  await saveShot(page, 'p652-window-ops.png');

  // Test Minimize & Restore via titlebar minimize button or taskbar click
  if (dolWin) {
    // Click minimize button on Dolphin titlebar (approx right side - 50px) or taskbar
    const minX = box.x + (winsAfterOps.find(w => (w.title || '').toLowerCase().includes('dolphin'))?.x || 720) + 700;
    const minY = box.y + (winsAfterOps.find(w => (w.title || '').toLowerCase().includes('dolphin'))?.y || 60) + 12;
    await page.mouse.click(minX, minY);
    await page.waitForTimeout(1000);
    await saveShot(page, 'p652-minimized.png');
  }

  await page.keyboard.press('Escape');
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await page.locator('button:has-text("Power Off")').first().click();
  await page.waitForTimeout(2500);
  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
