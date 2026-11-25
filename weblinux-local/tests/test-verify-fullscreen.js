const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Testing Fullscreen Viewport...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: [
      '--window-size=1600,900',
      '--enable-features=SharedArrayBuffer',
      '--use-gl=angle',
      '--use-angle=default'
    ]
  });

  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');
  console.log('Clicked Launch WebLinux. Waiting 25s for desktop...');

  for (let s = 1; s <= 25; s++) {
    await page.waitForTimeout(1000);
    const size = await page.evaluate(() => {
      const stage = document.getElementById('rv-stage');
      const sc = document.getElementById('screen');
      const cv = document.getElementById('display-canvas');
      return {
        stage: stage ? { w: stage.clientWidth, h: stage.clientHeight } : null,
        sc: sc ? { w: sc.clientWidth, h: sc.clientHeight } : null,
        cv: cv ? { w: cv.clientWidth, h: cv.clientHeight } : null,
        window: { w: window.innerWidth, h: window.innerHeight }
      };
    });
    if (s % 5 === 0) {
      console.log(`[T+${s}s] Dimensions:`, JSON.stringify(size));
    }
  }

  const shot = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1\\fullscreen-verified-desktop.png';
  await page.screenshot({ path: shot });
  console.log('Saved screenshot:', shot);

  await browser.close();
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
