const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer', '--window-size=1600,950'],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();

  console.log('[Phase 4] Checking Debian KDE boot & home isolation...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const chooseBtn = page.locator('text=Choose Distribution').first();
  if (await chooseBtn.isVisible()) {
    await chooseBtn.click();
  } else {
    await page.click('button:has-text("Distributions"), a:has-text("Distributions")');
  }
  await page.waitForTimeout(600);

  // Verify Ubuntu GNOME availability on Ubuntu card
  const ubuntuCard = page.locator('div:has-text("Ubuntu Noble Numbat")').last();
  await ubuntuCard.click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(500);
  const gnomeVisible = await page.locator('div:has-text("Ubuntu GNOME 46")').first().isVisible();
  const kdeVisible = await page.locator('div:has-text("Ubuntu KDE Plasma")').first().isVisible();
  const cliVisible = await page.locator('div:has-text("Ubuntu CLI Shell")').first().isVisible();
  console.log(`✓ Ubuntu profiles visible: KDE=${kdeVisible}, GNOME=${gnomeVisible}, CLI=${cliVisible}`);

  // Go back to Distributions and launch Debian KDE
  await page.click('button:has-text("Distributions"), a:has-text("Distributions")');
  await page.waitForTimeout(600);
  await page.locator('div:has-text("Trixie")').last().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(600);
  await page.locator('div:has-text("KDE Plasma")').first().click();
  await page.waitForTimeout(400);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();

  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
    }));
    if (st.state === 'running' && st.shellReady) {
      console.log(`✓ Debian KDE booted to running/shellReady in ${i + 1}s`);
      break;
    }
  }

  const debRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('df -h && debian cat /etc/os-release | head -n 2 && ls /debian/root/phase651-persist.txt 2>/dev/null || echo ISOLATED_OK', 15000);
  });
  console.log('[Phase 4] Debian df/os-release/isolation:\n' + (debRes.stdout || debRes.out || '').trim());

  await page.keyboard.press('Escape');
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await page.locator('button:has-text("Power Off")').first().click();
  await page.waitForTimeout(2000);
  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
