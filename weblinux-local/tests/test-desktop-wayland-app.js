const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=SharedArrayBuffer', '--no-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  // Wait for KDE Plasma to finish splash and settle
  console.log('Waiting 35s for desktop...');
  await page.waitForTimeout(35000);

  console.log('Checking running wlserver and plasma processes...');
  const ps = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('chroot /debian /bin/sh -c "ps w | grep -E \'desktop|wlserver|plasma\'"', 5000);
  });
  console.log('Processes:\n', (ps.stdout || ps.out || '').trim());

  console.log('\nLaunching konsole via desktop wayland...');
  const res = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('chroot /debian /bin/sh -c "/usr/local/bin/desktop wayland konsole > /tmp/konsole-test.log 2>&1 &"', 5000);
  });
  console.log('Launch command returned:', res);

  await page.waitForTimeout(5000);

  const klog = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/tmp/konsole-test.log', 5000);
  });
  console.log('Konsole log:\n', (klog.stdout || klog.out || '').trim());

  const wlserverLog = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/root/wlserver.log /root/wlserver.log 2>/dev/null', 5000);
  });
  console.log('wlserver.log tail:\n', (wlserverLog.stdout || wlserverLog.out || '').trim().slice(-1500));

  const windows = await page.evaluate(() => {
    return window.rvDisplay && window.rvDisplay.windows ? window.rvDisplay.windows() : [];
  });
  console.log('Active Wayland Windows:', JSON.stringify(windows, null, 2));

  await page.screenshot({ path: 'weblinux-local/docs/phase4/screenshots/03-konsole-running.png' });
  console.log('Saved 03-konsole-running.png');

  await browser.close();
})().catch(console.error);
