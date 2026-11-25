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
  await page.waitForTimeout(20000);

  const envCheck = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ls -la /tmp/runtime-root && ls -la /debian/tmp/runtime-root', 5000);
  });
  console.log('Runtime root contents:\n', (envCheck.stdout || envCheck.out || '').trim());

  const konsoleVer = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('chroot /debian /usr/bin/env XDG_RUNTIME_DIR=/tmp/runtime-root WAYLAND_DISPLAY=wayland-0 DISPLAY=:0 DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus HOME=/root konsole --version 2>&1', 5000);
  });
  console.log('Konsole version:\n', (konsoleVer.stdout || konsoleVer.out || '').trim());

  const launchOut = await page.evaluate(async () => {
    // Launch konsole in background and log output to /tmp/konsole.log
    await window.weblinuxAdapter.runCommand('chroot /debian /bin/sh -c "XDG_RUNTIME_DIR=/tmp/runtime-root WAYLAND_DISPLAY=wayland-0 DISPLAY=:0 DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus HOME=/root konsole > /tmp/konsole.log 2>&1 &"', 5000);
    await new Promise(r => setTimeout(r, 4000));
    return await window.weblinuxAdapter.runCommand('cat /debian/tmp/konsole.log /tmp/konsole.log', 5000);
  });
  console.log('Konsole log:\n', (launchOut.stdout || launchOut.out || '').trim());

  const ps = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ps aux', 5000);
  });
  console.log('ps aux:\n', (ps.stdout || ps.out || '').trim());

  const wlWindows = await page.evaluate(() => {
    return {
      windows: window.rvDisplay && window.rvDisplay.windows ? window.rvDisplay.windows() : null,
      keys: window.rvDisplay ? Object.keys(window.rvDisplay) : null
    };
  });
  console.log('rvDisplay inspection:\n', JSON.stringify(wlWindows, null, 2));

  await browser.close();
})().catch(console.error);
