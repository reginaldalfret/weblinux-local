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

  await page.evaluate(async () => {
    const a = window.weblinuxAdapter;
    await a.runCommand(
      'ubuntu "export XDG_RUNTIME_DIR=/tmp/runtime-root WAYLAND_DISPLAY=wayland-0 DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus GDK_BACKEND=wayland GSK_RENDERER=cairo LIBGL_ALWAYS_SOFTWARE=1; nohup zenity --info --title=Ubuntu-24.04-GNOME --text=Ubuntu_24.04.5_LTS_Noble_Numbat_GTK4_Wayland_Active > /root/zenity.log 2>&1 &"',
      5000
    );
  });
  await page.waitForTimeout(12000);

  const diag = await page.evaluate(async () => {
    const a = window.weblinuxAdapter;
    const zlog = await a.runCommand('cat /ubuntu/root/zenity.log 2>&1 || true', 5000);
    const ps = await a.runCommand('ps | grep -E "zenity|gnome" || true', 5000);
    return { zlog: zlog.stdout, ps: ps.stdout };
  });
  console.log('=== PS ===\n', diag.ps);
  console.log('=== ZENITY.LOG ===\n', diag.zlog);

  const shotPath = path.resolve(__dirname, 'screenshots/phase6/04-ubuntu-gnome-session.png');
  await page.screenshot({ path: shotPath });
  require('fs').copyFileSync(shotPath, 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1\\04-ubuntu-gnome-session.png');

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
