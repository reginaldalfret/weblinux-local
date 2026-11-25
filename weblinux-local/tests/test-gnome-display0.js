const { chromium } = require('playwright');
const path = require('path');

async function run() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const choose = page.locator('text=Choose Distribution').first();
  if (await choose.isVisible()) await choose.click();
  else await page.click('button:has-text("Distributions"), a:has-text("Distributions")');
  await page.waitForTimeout(600);
  await page.locator('div:has-text("Ubuntu Noble Numbat")').last().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(600);
  await page.locator('div:has-text("Ubuntu GNOME 46")').last().click();
  await page.waitForTimeout(300);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();

  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state);
    if (st === 'running' || st === 'error') break;
  }

  // Test with DISPLAY=:0 and --no-x11 --wayland-display=wayland-1
  const res = await page.evaluate(async () => {
    const a = window.weblinuxAdapter;
    await a.runCommand('killall -9 gnome-shell 2>/dev/null || true', 5000);
    await a.runCommand(
      'ubuntu "export XDG_RUNTIME_DIR=/tmp/runtime-root WAYLAND_DISPLAY=wayland-0 DISPLAY=:0 DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus GJS_DISABLE_JIT=1 JS_DISABLE_JIT=1 LIBGL_ALWAYS_SOFTWARE=1; nohup gnome-shell --nested --wayland --no-x11 --wayland-display=wayland-1 > /root/gnome-test.log 2>&1 &"',
      8000
    );
    return true;
  });
  await page.waitForTimeout(20000);
  const out = await page.evaluate(async () => {
    const a = window.weblinuxAdapter;
    const log = await a.runCommand('cat /ubuntu/root/gnome-test.log 2>&1 || true', 5000);
    const ps = await a.runCommand('ps | grep -E "gnome|Xwayland|nautilus" || true', 5000);
    return { log: log.stdout, ps: ps.stdout };
  });
  console.log('=== PS ===\n', out.ps);
  console.log('=== GNOME-TEST.LOG ===\n', out.log);
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots/phase6/gnome-display0-test.png') });

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
