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

  const check = async (cmd) => {
    const res = await page.evaluate(c => window.weblinuxAdapter.runCommand(c, 10000), cmd);
    console.log('\n>>> ' + cmd);
    console.log((res.stdout || res.out || '').trim());
  };

  await check('ls -la /tmp /tmp/runtime-root /debian/tmp /debian/tmp/runtime-root 2>/dev/null');
  await check('cat /root/wlserver.log 2>/dev/null | tail -n 25');
  await check('cat /root/desktop-status.log 2>/dev/null');
  await check('cat /debian/root/desktop.log 2>/dev/null | tail -n 25');
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
