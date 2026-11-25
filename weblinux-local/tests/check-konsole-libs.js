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
  await page.waitForTimeout(3000);

  const lddRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('chroot /debian /usr/bin/ldd /usr/bin/konsole 2>&1', 5000);
  });
  console.log('--- LDD KONSOLE ---');
  console.log((lddRes.stdout || lddRes.out || '').trim().slice(0, 1500));

  const runWithEnv = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      'chroot /debian /bin/sh -c "XDG_RUNTIME_DIR=/tmp/runtime-root WAYLAND_DISPLAY=wayland-0 DISPLAY=:0 DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus QT_DEBUG_PLUGINS=1 /usr/bin/konsole --help 2>&1"',
      8000
    );
  });
  console.log('--- QT_DEBUG_PLUGINS OUTPUT ---');
  console.log((runWithEnv.stdout || runWithEnv.out || '').trim().slice(0, 2000));

  await browser.close();
})().catch(console.error);
