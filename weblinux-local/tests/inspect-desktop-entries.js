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
  await page.waitForTimeout(3000);

  const check = async (cmd) => {
    const res = await page.evaluate(c => window.weblinuxAdapter.runCommand(c, 10000), cmd);
    console.log('\n>>> ' + cmd);
    console.log((res.stdout || res.out || '').trim());
  };

  await check('cat /debian/usr/share/applications/*konsole*.desktop 2>/dev/null | grep -E "^Exec=|^Name=" | head -n 10');
  await check('cat /debian/usr/share/applications/*dolphin*.desktop 2>/dev/null | grep -E "^Exec=|^Name=" | head -n 10');
  await check('cat /debian/root/.config/plasma-org.kde.plasma.desktop-appletsrc 2>/dev/null | grep -E "launchers|favorites|extraItems" | head -n 20');
  await check('ls -la /debian/root/.config 2>/dev/null');
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
