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

  await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  await p.locator('button:has-text("Configure & Launch Ubuntu")').first().click();
  await p.waitForTimeout(500);
  await p.locator('button[data-testid="launch-desktop-btn"]').first().click();

  for (let i = 0; i < 45; i++) {
    await p.waitForTimeout(1000);
    const st = await p.evaluate(() => window.weblinuxAdapter?.status?.state);
    if (st === 'running') break;
  }

  // Run es2_info with GALLIUM_DRIVER=virpipe
  const es2Info = await p.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      'ubuntu-kde "WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/tmp/runtime-root GALLIUM_DRIVER=virpipe VTEST_SOCKET_NAME=/tmp/runtime-root/rvgpu-0 /run/rvgpu/bin/es2_info"',
      20000
    );
  });
  console.log('=== es2_info (virpipe) ===\n' + (es2Info.stdout || es2Info.out || '').trim());

  // Launch es2gears_wayland with GALLIUM_DRIVER=virpipe
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

  for (let t = 0; t < 15; t++) {
    await p.waitForTimeout(1000);
    const stats = await p.evaluate(() => ({
      gpu: window.rvGpu?.stats,
      caps: window.weblinuxAdapter?.getGraphicsCapabilities?.(),
      wins: (window.rvDisplay?.windows?.() || []).map(w => ({ id: w.id, title: w.title, w: w.w, h: w.h })),
    }));
    if (stats.gpu?.exec?.records > 0 || t === 14) {
      console.log(`[+${t+1}s] GPU Stats:`, JSON.stringify(stats, null, 2));
      if (stats.gpu?.exec?.presents > 5) break;
    }
  }

  await saveShot(p, 'p7-01-es2gears-virpipe.png');

  const gearsLog = await p.evaluate(async () => {
    const r = await window.weblinuxAdapter.runCommand('cat /ubuntu/tmp/es2gears.log /ubuntu/root/rvgpu.log 2>/dev/null || true', 10000);
    return (r.stdout || r.out || '').trim();
  });
  console.log('=== es2gears & rvgpu logs ===\n' + gearsLog);

  await p.locator('button:has-text("Power Off")').first().click();
  await p.waitForTimeout(2500);
  await b.close();
})();
