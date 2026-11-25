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

  const appsInfo = await page.evaluate(() => {
    return {
      apps: window.rvDisplay && window.rvDisplay.apps ? window.rvDisplay.apps : null,
      windows: window.rvDisplay && window.rvDisplay.windows ? window.rvDisplay.windows() : null,
      windowList: window.rvDisplay && window.rvDisplay.windowList ? window.rvDisplay.windowList() : null
    };
  });
  console.log('--- APPS IN SERVER ---');
  console.log('Total apps:', appsInfo.apps ? appsInfo.apps.length : 0);
  if (appsInfo.apps) {
    appsInfo.apps.slice(0, 15).forEach((a, i) => console.log(`  [${i}] ${a.name} (${a.file}) -> Exec: ${a.exec || a.wmclass}`));
  }

  // Try launching konsole via rvDisplay.launchApp('konsole')
  console.log('\n--- LAUNCHING KONSOLE VIA rvDisplay.launchApp ---');
  const launched = await page.evaluate(() => {
    if (window.rvDisplay && window.rvDisplay.launchApp) {
      return window.rvDisplay.launchApp('konsole') || window.rvDisplay.launchApp('Terminal');
    }
    return false;
  });
  console.log('launchApp returned:', launched);

  await page.waitForTimeout(6000);

  const postLaunchWindows = await page.evaluate(() => {
    return {
      windowList: window.rvDisplay ? window.rvDisplay.windowList() : null,
      windows: window.rvDisplay ? window.rvDisplay.windows() : null
    };
  });
  console.log('Post launch windows:\n', JSON.stringify(postLaunchWindows, null, 2));

  await browser.close();
})().catch(console.error);
