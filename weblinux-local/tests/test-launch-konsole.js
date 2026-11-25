const { chromium } = require('playwright');

(async () => {
  console.log('=== TESTING KONSOLE LAUNCH IN WAYLAND SESSION ===');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=SharedArrayBuffer']
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  page.on('console', msg => {
    const t = msg.text();
    if (t.includes('display:') || t.includes('plasma:') || t.includes('wlserver') || t.includes('konsole')) {
      console.log('  [Console]', t);
    }
  });

  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');
  console.log('Waiting for desktop to be running...');

  for (let i = 0; i < 35; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await page.waitForTimeout(6000);

  // Check initial windows
  const initialWindows = await page.evaluate(() => {
    return window.rvDisplay ? window.rvDisplay.windows : null;
  });
  console.log('Initial Windows:', JSON.stringify(initialWindows));

  // Now execute desktop wayland konsole
  console.log('\nExecuting: chroot /debian /usr/local/bin/desktop wayland konsole &');
  await page.evaluate(async () => {
    // Launch in background
    window.weblinuxAdapter.sendInput('chroot /debian /usr/local/bin/desktop wayland konsole &\r');
  });

  // Monitor windows for 15 seconds
  for (let s = 1; s <= 15; s++) {
    await page.waitForTimeout(1000);
    const wins = await page.evaluate(() => {
      return {
        count: window.rvDisplay ? (window.rvDisplay.windows ? Object.keys(window.rvDisplay.windows).length : 0) : 0,
        windows: window.rvDisplay ? window.rvDisplay.windows : null,
      };
    });
    console.log(`[T+${s}s] Window count: ${wins.count}`);
    if (wins.count > 2) {
      console.log('New window detected! Details:', JSON.stringify(wins.windows));
      break;
    }
  }

  // Take screenshot
  const shot = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1\\konsole-launch-test.png';
  await page.screenshot({ path: shot });
  console.log('Screenshot saved:', shot);

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
