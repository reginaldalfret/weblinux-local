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

  console.log('Testing launch inside Debian chroot:');
  const launchRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('chroot /debian /usr/bin/konsole --version 2>&1', 5000);
  });
  console.log('Konsole version:', (launchRes.stdout || launchRes.out || '').trim());

  const allWins = await page.evaluate(() => window.rvDisplay ? window.rvDisplay.windows() : []);
  console.log('ALL CURRENT WINDOWS:', JSON.stringify(allWins, null, 2));

  await browser.close();
})().catch(console.error);
