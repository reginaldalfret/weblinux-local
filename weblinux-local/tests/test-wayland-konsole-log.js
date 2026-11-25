const { chromium } = require('playwright');

(async () => {
  console.log('=== TESTING DESKTOP WAYLAND KONSOLE RUN ===');
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-features=SharedArrayBuffer'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');
  for (let i = 0; i < 35; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await page.waitForTimeout(4000);

  // Run desktop wayland konsole in background
  const res = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('chroot /debian /usr/local/bin/desktop wayland konsole > /debian/tmp/konsole-wayland.log 2>&1 &', 5000);
  });
  console.log('Command launched:', res);

  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1000);
    const wins = await page.evaluate(() => window.rvDisplay ? window.rvDisplay.windows() : []);
    console.log(`[T+${s}s] Window count: ${wins.length}`);
    if (wins.length > 0) {
      console.log('WINDOWS DETECTED:', JSON.stringify(wins));
    }
  }

  const log = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/tmp/konsole-wayland.log 2>/dev/null', 5000);
  });
  console.log('\n--- /debian/tmp/konsole-wayland.log ---');
  console.log((log.stdout || log.out || '').trim());

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
