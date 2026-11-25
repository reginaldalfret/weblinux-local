const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== LAUNCHING LIVE VISIBLE EDGE ===');
  
  // Use a clean temporary user data dir to avoid any lock contention with existing Edge
  const userDataDir = path.resolve(__dirname, '.pw-edge-user-data');
  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'msedge',
    headless: false, // VISIBLE TO USER
    viewport: null, // Allow full window size
    args: [
      '--start-maximized',
      '--enable-features=SharedArrayBuffer',
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=default'
    ]
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  page.on('console', msg => {
    const t = msg.text();
    if (t.includes('display:') || t.includes('plasma:') || t.includes('splash:') || t.includes('[Boot') || t.includes('error')) {
      console.log('  [Console]', t);
    }
  });

  page.on('pageerror', err => {
    console.error('  [PageError]', err.message);
  });

  page.on('crash', () => {
    console.error('  [CRASH] Page crashed!');
  });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  console.log('Page loaded:', await page.title());

  await page.waitForTimeout(1000);

  // Click Launch WebLinux
  const launchBtn = page.locator('button:has-text("Launch WebLinux")').first();
  if (await launchBtn.isVisible()) {
    console.log('Clicking Launch WebLinux...');
    await launchBtn.click();
  }

  console.log('Monitoring boot sequence for 60 seconds...');
  for (let s = 1; s <= 60; s++) {
    await page.waitForTimeout(1000);
    if (s % 5 === 0) {
      const info = await page.evaluate(() => {
        const ad = window.weblinuxAdapter;
        return {
          state: ad ? ad.status.state : 'none',
          mem: ad ? ad.status.allocatedMemoryMB : 0,
          wayland: ad ? ad.status.waylandActive : false,
          uptime: ad ? ad.status.uptimeSeconds : 0
        };
      }).catch(e => ({ error: e.message }));
      console.log(`[T+${s}s] Adapter:`, JSON.stringify(info));
    }
  }

  const screenshotPath = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1\\live-user-edge-result.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);

  // Keep it open for user to see!
  console.log('Edge is left open for the user.');
})().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
