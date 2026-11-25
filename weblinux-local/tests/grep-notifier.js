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

  const res = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('grep -n -C 10 "StatusNotifierWatcher" /debian/usr/local/bin/desktop', 10000);
  });
  console.log('\n--- StatusNotifierWatcher in /debian/usr/local/bin/desktop ---');
  console.log((res.stdout || res.out || '').trim());

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
