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
    const res = await page.evaluate(c => window.weblinuxAdapter.runCommand(`chroot /debian ${c}`, 15000), cmd);
    console.log((res.stdout || res.out || '').trim());
  };

  await testCmd('dpkg query', 'dpkg-query -W -f "${Package}\t${Version}\t${db:Status-Status}\n" gnome-shell mutter xfce4-session labwc thunar nautilus plasma-desktop');
  await testCmd('which check', 'which gnome-shell mutter xfce4-session labwc thunar nautilus konsole dolphin');

  await browser.close();
})().catch(console.error);
