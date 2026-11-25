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
  await page.waitForTimeout(30000);

  const check = async (label, cmd) => {
    console.log(`\n=== ${label} (${cmd}) ===`);
    const res = await page.evaluate(c => window.weblinuxAdapter.runCommand(c, 10000), cmd);
    console.log((res.stdout || res.out || '').trim());
  };

  await check('1. /init content', 'cat /init');
  await check('2. /bin/debian content', 'cat /bin/debian');
  await check('3. Check gnome/xfce/mutter/labwc binaries in debian', 'chroot /debian /bin/sh -c "which gnome-shell mutter labwc xfce4-session startxfce4 xfce4-panel thunar nautilus 2>&1"');
  await check('4. Check apt sources.list in debian', 'chroot /debian /bin/sh -c "cat /etc/apt/sources.list"');
  await check('5. Check dpkg status for gnome or xfce', 'chroot /debian /bin/sh -c "dpkg -l | grep -E \"gnome|xfce|labwc|mutter\" || echo NONE"');

  await browser.close();
})().catch(console.error);
