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
  await page.waitForTimeout(5000);

  const psOuter = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ps', 5000);
  });
  console.log('OUTER PS:');
  console.log((psOuter.stdout || psOuter.out || '').trim());

  const psInner = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('chroot /debian ps aux 2>/dev/null || chroot /debian ps', 5000);
  });
  console.log('\nINNER PS:');
  console.log((psInner.stdout || psInner.out || '').trim());

  await browser.close();
})().catch(console.error);
