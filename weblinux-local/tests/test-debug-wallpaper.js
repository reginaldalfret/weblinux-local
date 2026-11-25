const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROFILE_DIR = path.resolve(__dirname, `.pw-debug-profile-${Date.now()}`);

async function debugWallpaper() {
  const browserContext = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1600, height: 1000 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-features=SharedArrayBuffer',
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=default',
      '--window-size=1600,1000',
    ],
  });

  const page = browserContext.pages()[0] || await browserContext.newPage();
  await page.setViewportSize({ width: 1600, height: 1000 });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Launch WebLinux")').first().click();

  console.log('Waiting 45 seconds for desktop to initialize and settle...');
  await page.waitForTimeout(45000);

  const debugInfo = await page.evaluate(() => {
    const stage = document.getElementById('rv-stage');
    const pl = window.rvPlasma;
    const disp = window.rvDisplay;
    const elements = stage ? Array.from(stage.children).map(c => ({
      tag: c.tagName,
      id: c.id,
      className: c.className,
      style: c.getAttribute('style'),
      outer: c.outerHTML.slice(0, 200)
    })) : [];

    return {
      wp: pl && pl.theme ? pl.theme.wallpaper : null,
      active: disp ? disp.active() : false,
      elements,
    };
  });

  console.log('Debug Info:', JSON.stringify(debugInfo, null, 2));

  const shot = path.resolve(__dirname, 'screenshots/playwright-verification/debug-wallpaper.png');
  await page.screenshot({ path: shot });
  console.log('Saved debug screenshot:', shot);

  await browserContext.close();
}

debugWallpaper().catch(console.error);
