const { chromium } = require('playwright');

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

  const helpRes = await page.evaluate(async () => {
    const a = window.weblinuxAdapter;
    const gh = await a.runCommand('ubuntu gnome-shell --help 2>&1', 8000);
    const mh = await a.runCommand('ubuntu mutter --help 2>&1', 8000);
    const sock = await a.runCommand('ls -la /ubuntu/tmp/runtime-root /ubuntu/tmp/.X11-unix 2>&1 || true', 5000);
    return { gh: gh.stdout, mh: mh.stdout, sock: sock.stdout };
  });
  console.log('=== GNOME-SHELL --HELP ===\n', helpRes.gh);
  console.log('=== MUTTER --HELP ===\n', helpRes.mh);
  console.log('=== SOCKETS ===\n', helpRes.sock);

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
