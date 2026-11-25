const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROFILE_DIR = path.resolve(__dirname, `.pw-inspect-profile-${Date.now()}`);

async function inspectLifecycle() {
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

  page.on('console', msg => console.log('   [Console]', msg.text()));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Launch WebLinux")').first().click();

  console.log('Taking screenshots every 10 seconds from T+20s to T+70s...');
  for (let s = 10; s <= 70; s += 10) {
    await page.waitForTimeout(10000);
    const shot = path.resolve(__dirname, `screenshots/playwright-verification/step-${s}s.png`);
    await page.screenshot({ path: shot });
    console.log(`Saved screenshot at T+${s}s: ${shot} (${fs.statSync(shot).size} bytes)`);

    const info = await page.evaluate(() => {
      const stage = document.getElementById('rv-stage');
      const canvas = document.getElementById('display-canvas');
      const sc = document.getElementById('screen');
      const sp = window.rvSplash ? window.rvSplash.state() : null;
      const pl = window.rvPlasma ? window.rvPlasma.theme : null;
      return {
        stageHTML: stage ? stage.outerHTML.slice(0, 300) : null,
        canvasStyle: canvas ? canvas.getAttribute('style') : null,
        canvasW: canvas ? canvas.width : 0,
        canvasH: canvas ? canvas.height : 0,
        splash: sp,
        wp: pl ? pl.wallpaper : null,
      };
    });
    console.log(`   [T+${s}s Info]:`, JSON.stringify(info));
  }

  await browserContext.close();
}

inspectLifecycle().catch(console.error);
