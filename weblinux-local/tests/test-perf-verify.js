const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: [
      '--no-sandbox',
      '--enable-features=SharedArrayBuffer',
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=default',
      '--window-size=1600,950',
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();

  const t0 = Date.now();
  console.log('[1] Opening http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  console.log('[2] Navigating to Ubuntu KDE...');
  const ubuntuBtn = page.locator('button:has-text("Configure & Launch Ubuntu")').first();
  if (await ubuntuBtn.isVisible()) {
    await ubuntuBtn.click();
  } else {
    await page.click('button:has-text("Distributions")');
    await page.waitForTimeout(500);
    await page.locator('div:has-text("Ubuntu Noble Numbat")').last().click();
    await page.waitForTimeout(400);
    await page.locator('button:has-text("Configure Desktop")').click();
  }
  await page.waitForTimeout(600);
  console.log('[3] Clicking Launch...');
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();
  console.log('[4] Waiting for runtime...');

  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
    }));
    if (st.state === 'running' && st.shellReady) {
      console.log(`✓ Runtime ready in ${Math.round((Date.now() - t0)/1000)}s`);
      break;
    }
  }

  for (let w = 0; w < 30; w++) {
    await page.waitForTimeout(4000);
    const ui = await page.evaluate(() => ({
      splashShown: window.rvSplash?.state?.().shown,
      windows: window.rvDisplay?.windows?.().map(x => x.title) || [],
    }));
    if (ui.splashShown === false && ui.windows.includes('Plasma')) {
      console.log(`✓ Splash dismissed & Plasma panel mapped in ${Math.round((Date.now() - t0)/1000)}s`);
      break;
    }
  }

  const sessLog = await page.evaluate(async () => {
    const r = await window.weblinuxAdapter.runCommand('cat /ubuntu/root/ubuntu-kde-session.log /ubuntu/root/rvgpu.log 2>/dev/null || true', 15000);
    return (r.stdout || r.out || '').trim();
  });
  console.log('Session/rvgpu log:\n' + sessLog);

  // Measure Dolphin launch speed after UDisks2 fix
  const d0 = Date.now();
  await page.evaluate(async () => {
    await window.weblinuxAdapter.runCommand(`cat <<'EOF' > /ubuntu/tmp/launch-dolphin.sh
#!/bin/bash
export DISPLAY=
export WAYLAND_DISPLAY=wayland-0
export XDG_RUNTIME_DIR=/tmp/runtime-root
export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus
export QT_QPA_PLATFORM=wayland
export QT_QUICK_BACKEND=software
export QMLSCENE_DEVICE=softwarecontext
export LIBGL_ALWAYS_SOFTWARE=1
nohup dolphin >/tmp/dolphin-perf.log 2>&1 &
EOF
chmod +x /ubuntu/tmp/launch-dolphin.sh
ubuntu-kde /tmp/launch-dolphin.sh`, 15000);
  });

  for (let d = 0; d < 40; d++) {
    await page.waitForTimeout(1000);
    const wins = await page.evaluate(() => (window.rvDisplay?.windows?.() || []).map(w => w.title));
    if (wins.some(t => (t || '').toLowerCase().includes('dolphin'))) {
      console.log(`✓ Dolphin mapped in ${Math.round((Date.now() - d0)/1000)}s (previously 52s)`);
      break;
    }
  }

  await page.locator('button:has-text("Power Off")').first().click();
  await page.waitForTimeout(2500);
  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
