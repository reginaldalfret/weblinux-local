const { chromium } = require('playwright');

(async () => {
  console.log('Launching Microsoft Edge without special flags...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const page = await browser.newPage();
  page.on('console', m => console.log('CONSOLE [' + m.type() + ']:', m.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err));
  page.on('crash', () => console.log('PAGE CRASHED! (crash event received)'));

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000');
  console.log('Page title:', await page.title());

  console.log('Clicking Launch WebLinux...');
  await page.click('button:has-text("Launch WebLinux")');
  console.log('Clicked. Waiting 30s...');

  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    try {
      const url = page.url();
      const state = await page.evaluate(() => {
        return {
          runtimeState: window.wasmLinuxAdapter ? window.wasmLinuxAdapter.status.state : 'no-adapter',
          bootOutputLength: window.wasmLinuxAdapter ? (window.wasmLinuxAdapter.bootOutput || '').length : 0,
        };
      });
      console.log(`T+${i+1}s: url=${url} state=${JSON.stringify(state)}`);
      if (state.runtimeState === 'running') {
        console.log('Running reached!');
        break;
      }
    } catch (e) {
      console.log(`T+${i+1}s: evaluate error: ${e.message}`);
    }
  }

  await browser.close();
  console.log('Done.');
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
