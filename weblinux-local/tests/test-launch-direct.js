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
  await page.waitForTimeout(15000);

  const testCmd = async (label, cmd) => {
    console.log(`\n--- ${label} ---`);
    const res = await page.evaluate(c => window.weblinuxAdapter.runCommand(c, 10000), cmd);
    console.log('EXIT:', res.exitCode, res.rc);
    console.log('OUT:', (res.stdout || res.out || '').trim());
  };

  await testCmd('1. Check /bin/debian', 'ls -la /bin/debian /usr/local/bin/desktop /debian/usr/local/bin/desktop');
  await testCmd('2. Test debian desktop wayland konsole', '/bin/debian desktop wayland konsole 2>&1');
  await testCmd('3. Check wlserver socket', 'ls -la /tmp /debian/tmp /run /debian/run');

  await browser.close();
})().catch(console.error);
