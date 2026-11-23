const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Testing KDE Plasma Kickoff Application Menu...');
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

  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  console.log('Waiting 35s for KDE Plasma to finish splash...');
  await page.waitForTimeout(35000);

  // Get canvas box and layer surfaces
  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const rect = canvas ? canvas.getBoundingClientRect() : null;
    const wins = window.rvDisplay && window.rvDisplay.windows ? window.rvDisplay.windows() : [];
    return {
      rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      wins
    };
  });
  console.log('Canvas Rect and Windows:', JSON.stringify(info, null, 2));

  // Screenshot before click
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-desktop-startup.png') });
  console.log('Saved 01-desktop-startup.png');

  // Let's press Super (Meta) key to toggle Kickoff launcher
  console.log('Pressing Meta key (Super) to trigger application menu...');
  const canvas = await page.$('canvas');
  if (canvas) {
    await canvas.click({ position: { x: 400, y: 400 } });
    await page.keyboard.press('Meta');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-application-launcher.png') });
    console.log('Saved 02-application-launcher.png with Meta key');

    // Also test clicking bottom-left corner of the canvas (where Kickoff icon is on the Plasma panel)
    const panelWin = info.wins.find(w => w.role === 2);
    const clickY = panelWin ? (panelWin.y + panelWin.h / 2) : (info.rect.height - 25);
    console.log(`Clicking Kickoff button at (25, ${clickY})...`);
    await canvas.click({ position: { x: 25, y: Math.min(clickY, info.rect.height - 15) } });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-application-launcher-click.png') });
    console.log('Saved 02-application-launcher-click.png');

    // Check windows again
    const postWins = await page.evaluate(() => window.rvDisplay && window.rvDisplay.windows ? window.rvDisplay.windows() : []);
    console.log('Post click windows:', JSON.stringify(postWins, null, 2));
  }

  await browser.close();
  console.log('Kickoff test finished.');
})().catch(console.error);
