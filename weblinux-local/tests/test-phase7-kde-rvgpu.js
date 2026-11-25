const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/phase7-gpu');
const ARTIFACT_DIR = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function saveShot(page, name) {
  const lp = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: lp });
  fs.copyFileSync(lp, path.join(ARTIFACT_DIR, name));
  console.log('✓ Screenshot:', lp);
}

(async () => {
  const b = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer', '--enable-unsafe-webgpu', '--window-size=1600,950'],
  });
  const context = await b.newContext({ viewport: { width: 1600, height: 950 } });
  const p = await context.newPage();

  const t0 = Date.now();
  await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  await p.locator('button:has-text("Configure & Launch Ubuntu")').first().click();
  await p.waitForTimeout(500);
  await p.locator('button[data-testid="launch-desktop-btn"]').first().click();

  for (let i = 0; i < 45; i++) {
    await p.waitForTimeout(1000);
    if ((await p.evaluate(() => window.weblinuxAdapter?.status?.state)) === 'running') {
      console.log(`✓ Runtime ready in ${Math.round((Date.now() - t0)/1000)}s`);
      break;
    }
  }

  for (let w = 0; w < 35; w++) {
    await p.waitForTimeout(4000);
    const ui = await p.evaluate(() => ({
      splashShown: window.rvSplash?.state?.().shown,
      windows: (window.rvDisplay?.windows?.() || []).map(x => x.title),
      gpu: window.rvGpu?.stats?.exec,
    }));
    if (ui.splashShown === false && ui.windows.includes('Plasma')) {
      console.log(`✓ Splash dismissed & Plasma panel mapped in ${Math.round((Date.now() - t0)/1000)}s | GPU=${JSON.stringify(ui.gpu)}`);
      await p.waitForTimeout(4000);
      break;
    }
  }

  await saveShot(p, 'p7-02-plasma-rvgpu.png');

  // Launch es2gears_wayland on top of the visible Plasma desktop
  await p.evaluate(async () => {
    await window.weblinuxAdapter.runCommand(`cat <<'EOF' > /ubuntu/tmp/run-gears.sh
#!/bin/bash
export WAYLAND_DISPLAY=wayland-0
export XDG_RUNTIME_DIR=/tmp/runtime-root
export GALLIUM_DRIVER=virpipe
export VTEST_SOCKET_NAME=/tmp/runtime-root/rvgpu-0
nohup /run/rvgpu/bin/es2gears_wayland >/tmp/es2gears.log 2>&1 &
EOF
chmod +x /ubuntu/tmp/run-gears.sh
ubuntu-kde /tmp/run-gears.sh`, 15000);
  });

  await p.waitForTimeout(8000);
  await saveShot(p, 'p7-03-es2gears-on-plasma.png');

  const finalDiag = await p.evaluate(async () => {
    const r = await window.weblinuxAdapter.runCommand(
      'cat /ubuntu/root/ubuntu-kde-session.log /ubuntu/root/qt.log /ubuntu/root/rvgpu.log 2>/dev/null | head -n 60',
      15000
    );
    return {
      caps: window.weblinuxAdapter?.getGraphicsCapabilities?.(),
      gpuStats: window.rvGpu?.stats,
      guestLogs: (r.stdout || r.out || '').trim(),
    };
  });

  console.log('=== PHASE 7 RVGPU DIAGNOSTICS ===');
  console.log('Capabilities:', JSON.stringify(finalDiag.caps, null, 2));
  console.log('GPU Exec Stats:', JSON.stringify(finalDiag.gpuStats?.exec, null, 2));
  console.log('Guest Logs:\n' + finalDiag.guestLogs);

  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'phase7-rvgpu-results.json'), JSON.stringify(finalDiag, null, 2));

  await p.locator('button:has-text("Power Off")').first().click();
  await p.waitForTimeout(2500);
  await b.close();
})();
