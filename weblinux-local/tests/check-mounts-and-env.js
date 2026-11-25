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

  const mounts = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('mount', 5000);
  });
  console.log('--- GUEST MOUNTS ---');
  console.log((mounts.stdout || mounts.out || '').trim());

  const initScript = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /init /etc/init.d/* /etc/rc.local 2>/dev/null', 5000);
  });
  console.log('\n--- INIT SCRIPT ---');
  console.log((initScript.stdout || initScript.out || '').trim().slice(0, 1000));

  const debianMounts = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ls -la /debian/proc /debian/sys /debian/dev /debian/dev/pts 2>/dev/null', 5000);
  });
  console.log('\n--- DEBIAN SPECIAL DIRS ---');
  console.log((debianMounts.stdout || debianMounts.out || '').trim());

  await browser.close();
})().catch(console.error);
