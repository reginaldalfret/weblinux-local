const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-features=SharedArrayBuffer'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');
  for (let i = 0; i < 35; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await page.waitForTimeout(4000);

  const apps = await page.evaluate(() => {
    return window.rvDisplayHost ? window.rvDisplayHost.apps() : null;
  });
  console.log('Installed Apps via rvDisplayHost.apps():');
  console.log(JSON.stringify(apps, null, 2));

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
