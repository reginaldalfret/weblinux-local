const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
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

  // Wait 15 seconds for gnome-shell to either render or log its error
  await page.waitForTimeout(15000);

  const diag = await page.evaluate(async () => {
    const a = window.weblinuxAdapter;
    const ps = await a.runCommand('ps | grep -E "gnome|mutter|hostnode|dbus" || true', 8000);
    const glog = await a.runCommand('cat /ubuntu/root/gnome-shell.log 2>&1 || true', 8000);
    const wlog = await a.runCommand('cat /ubuntu/root/wlserver.log 2>&1 | tail -n 30 || true', 8000);
    return { ps: ps.stdout, glog: glog.stdout, wlog: wlog.stdout };
  });

  console.log('=== PS ===\n', diag.ps);
  console.log('=== GNOME-SHELL.LOG ===\n', diag.glog);
  console.log('=== WLSERVER.LOG ===\n', diag.wlog);

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
