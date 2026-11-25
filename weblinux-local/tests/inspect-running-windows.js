const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-features=SharedArrayBuffer'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await page.waitForTimeout(10000);
  const apps = await page.evaluate(() => window.rvDisplay && window.rvDisplay.apps ? window.rvDisplay.apps.map(a => ({ name: a.name, file: a.file, wmclass: a.wmclass })) : []);
  console.log('ALL APPS:', JSON.stringify(apps, null, 2));

  // Test launching Dolphin
  console.log('Launching Dolphin via launchApp...');
  const launched = await page.evaluate(() => window.rvDisplay && window.rvDisplay.launchApp ? window.rvDisplay.launchApp('dolphin') : false);
  console.log('launchApp returned:', launched);

  for (let s = 1; s <= 12; s++) {
    await page.waitForTimeout(1000);
    const wins = await page.evaluate(() => window.rvDisplay ? window.rvDisplay.windows() : []);
    console.log(`[T+${s}s] Window count: ${wins.length}`);
    if (wins.length > 0) {
      console.log('WINDOWS:', JSON.stringify(wins, null, 2));
      break;
    }
  }

  await browser.close();
})().catch(console.error);
