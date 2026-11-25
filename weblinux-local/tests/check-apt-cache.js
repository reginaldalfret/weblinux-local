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

  const testCmd = async (label, cmd) => {
    console.log(`\n=== ${label} ===`);
    const res = await page.evaluate(c => window.weblinuxAdapter.runCommand(`chroot /debian /bin/sh -c "${c}"`, 15000), cmd);
    console.log((res.stdout || res.out || '').trim());
  };

  await testCmd('1. Search gnome-shell', 'apt-cache search --names-only "^gnome-shell" | head -n 5');
  await testCmd('2. Search mutter', 'apt-cache search --names-only "^mutter" | head -n 5');
  await testCmd('3. Search xfce4-session & labwc', 'apt-cache search --names-only "^xfce4-session|^labwc" | head -n 5');
  await testCmd('4. Check existing desktop binaries', 'ls -la /usr/bin/gnome* /usr/bin/xfce* /usr/bin/thunar /usr/bin/nautilus /usr/bin/labwc /usr/bin/mutter 2>/dev/null || echo NONE');
  await testCmd('5. Check installed desktop packages', 'dpkg-query -W "gnome*" "xfce*" "labwc*" "mutter*" 2>/dev/null || echo NONE');

  await browser.close();
})().catch(console.error);
