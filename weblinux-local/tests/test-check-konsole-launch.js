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
  console.log('Waiting for desktop settle (35s)...');
  await page.waitForTimeout(35000);

  // Try launching konsole via `debian desktop wayland konsole`
  console.log('Launching konsole via `debian desktop wayland konsole`...');
  const res = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('debian desktop wayland konsole > /tmp/ktest.log 2>&1 &', 5000);
  });
  console.log('runCommand returned:', res);

  await page.waitForTimeout(5000);

  const klog = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/tmp/ktest.log /tmp/ktest.log 2>/dev/null', 5000);
  });
  console.log('ktest.log:\n', (klog.stdout || klog.out || '').trim());

  const wlserverLog = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/root/wlserver.log /root/wlserver.log 2>/dev/null', 5000);
  });
  console.log('wlserver.log end:\n', (wlserverLog.stdout || wlserverLog.out || '').trim().slice(-1200));

  const windows = await page.evaluate(() => {
    return {
      windowList: window.rvDisplay && window.rvDisplay.windowList ? window.rvDisplay.windowList() : [],
      allWindows: window.rvDisplay && window.rvDisplay.windows ? window.rvDisplay.windows() : []
    };
  });
  console.log('Windows:', JSON.stringify(windows, null, 2));

  await browser.close();
})().catch(console.error);
