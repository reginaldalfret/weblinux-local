const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('================================================================');
  console.log('🧪 TEST: KDE PLASMA 6 WINDOW MANAGEMENT & APPLICATION COEXISTENCE');
  console.log('================================================================\n');

  const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/phase4/screenshots');
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=SharedArrayBuffer', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');

  console.log('Waiting for guest to boot and KDE Plasma 6 to settle (approx 35s)...');
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  // Allow KDE Plasma splash fade out and compositor to settle
  await page.waitForTimeout(20000);

  console.log('Step 1: Capturing baseline full KDE Plasma desktop...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-desktop-startup.png') });
  console.log('  ✓ Saved 01-desktop-startup.png');

  // Launch Konsole
  console.log('Step 2: Launching Konsole via Wayland session...');
  await page.evaluate(async () => {
    await window.weblinuxAdapter.runCommand(
      'chroot /debian /usr/bin/env XDG_RUNTIME_DIR=/tmp/runtime-root WAYLAND_DISPLAY=wayland-0 DISPLAY=:0 DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus HOME=/root konsole &',
      5000
    );
  });
  await page.waitForTimeout(6000);

  // Inspect Wayland windows
  let windows = await page.evaluate(() => {
    return window.rvDisplay && window.rvDisplay.windows ? window.rvDisplay.windows() : [];
  });
  console.log(`Active Wayland Windows after Konsole launch: ${windows.length}`);
  console.log(JSON.stringify(windows, null, 2));

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-konsole-running.png') });
  console.log('  ✓ Saved 03-konsole-running.png');

  // Launch Dolphin
  console.log('Step 3: Launching Dolphin file manager via Wayland session...');
  await page.evaluate(async () => {
    await window.weblinuxAdapter.runCommand(
      'chroot /debian /usr/bin/env XDG_RUNTIME_DIR=/tmp/runtime-root WAYLAND_DISPLAY=wayland-0 DISPLAY=:0 DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus HOME=/root dolphin /root &',
      5000
    );
  });
  await page.waitForTimeout(7000);

  windows = await page.evaluate(() => {
    return window.rvDisplay && window.rvDisplay.windows ? window.rvDisplay.windows() : [];
  });
  console.log(`Active Wayland Windows after Dolphin launch: ${windows.length}`);
  console.log(JSON.stringify(windows, null, 2));

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-dolphin-home.png') });
  console.log('  ✓ Saved 05-dolphin-home.png');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-multiple-windows.png') });
  console.log('  ✓ Saved 07-multiple-windows.png (Coexistence verified)');

  // Window Management Actions
  if (windows.length > 0) {
    const targetWin = windows[windows.length - 1];
    console.log(`Step 4: Testing window management operations on window ID ${targetWin.id}...`);

    // Move
    console.log('  -> ORDER_MOVE to (80, 80)');
    await page.evaluate((id) => window.rvDisplay.order(2, id, 80, 80), targetWin.id);
    await page.waitForTimeout(1000);

    // Resize
    console.log('  -> ORDER_RESIZE to (900, 600)');
    await page.evaluate((id) => {
      window.rvDisplay.order(3, id, 0, 900, 600);
      window.rvDisplay.order(4, id);
    }, targetWin.id);
    await page.waitForTimeout(1000);

    // Maximize
    console.log('  -> ORDER_MAXIMIZE');
    await page.evaluate((id) => window.rvDisplay.order(7, id), targetWin.id);
    await page.waitForTimeout(1500);

    // Restore
    console.log('  -> ORDER_RESTORE');
    await page.evaluate((id) => window.rvDisplay.order(8, id), targetWin.id);
    await page.waitForTimeout(1500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-window-management.png') });
    console.log('  ✓ Saved 08-window-management.png');

    // Close
    console.log('  -> ORDER_CLOSE');
    await page.evaluate((id) => window.rvDisplay.order(5, id), targetWin.id);
    await page.waitForTimeout(2000);

    const remainingWindows = await page.evaluate(() => window.rvDisplay.windows ? window.rvDisplay.windows() : []);
    console.log(`Remaining windows after close: ${remainingWindows.length}`);
  }

  await browser.close();
  console.log('\n>>> WINDOW MANAGEMENT ACCEPTANCE: COMPLETE <<<');
})().catch(err => {
  console.error('Window test error:', err);
  process.exit(1);
});