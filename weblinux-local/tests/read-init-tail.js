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
  await page.waitForTimeout(30000);

  const res = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('sed -n "80,180p" /init', 5000);
  });
  console.log('=== /init lines 80-180 ===');
  console.log((res.stdout || res.out || '').trim());

  await browser.close();
})().catch(console.error);
