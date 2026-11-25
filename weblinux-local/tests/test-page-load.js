const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=SharedArrayBuffer'],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  page.on('console', msg => console.log('  [Console]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('  [PageError]', err.message, err.stack));
  page.on('crash', () => console.error('  🔥 [CRASH] PAGE CRASHED! (STATUS_ACCESS_VIOLATION or STATUS_STACK_OVERFLOW)'));

  console.log('1. Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  console.log('2. Clicking Launch WebLinux...');
  await page.locator('button:has-text("Launch WebLinux")').first().click();

  console.log('3. Waiting 30 seconds to observe boot lifecycle and any crash...');
  for (let s = 1; s <= 30; s++) {
    await page.waitForTimeout(1000);
    if (s % 5 === 0) {
      const state = await page.evaluate(() => {
        const ad = window.weblinuxAdapter;
        const sp = window.rvSplash ? window.rvSplash.state() : null;
        const dp = window.rvDisplay;
        return {
          status: ad ? ad.getStatus() : 'no adapter',
          splash: sp ? { shown: sp.shown, text: sp.text } : 'no splash',
          displayActive: dp ? dp.active() : false,
        };
      }).catch(err => `Evaluate error: ${err.message}`);
      console.log(`[T+${s}s]`, JSON.stringify(state));
    }
  }

  await browser.close();
})();
