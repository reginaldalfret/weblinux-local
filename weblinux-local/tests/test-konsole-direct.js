const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=SharedArrayBuffer', '--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await page.waitForTimeout(5000);

  const helpRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('chroot /debian /usr/bin/konsole --help 2>&1', 5000);
  });
  console.log('--- KONSOLE HELP ---');
  console.log((helpRes.stdout || helpRes.out || '').trim());

  const dolphinHelp = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('chroot /debian /usr/bin/dolphin --help 2>&1', 5000);
  });
  console.log('--- DOLPHIN HELP ---');
  console.log((dolphinHelp.stdout || dolphinHelp.out || '').trim());

  await browser.close();
})().catch(console.error);
