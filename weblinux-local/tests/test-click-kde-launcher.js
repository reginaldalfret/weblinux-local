const { chromium } = require('playwright');

(async () => {
  console.log('=== TESTING KDE PLASMA APPLICATION LAUNCHER CLICK ===');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=SharedArrayBuffer']
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  page.on('console', msg => {
    const t = msg.text();
    if (t.includes('display:') || t.includes('plasma:')) {
      console.log('  [Console]', t);
    }
  });

  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');
  console.log('Waiting for desktop to settle (35s)...');

  for (let i = 0; i < 35; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await page.waitForTimeout(6000);

  // Get canvas coordinates
  const canvasBox = await page.evaluate(() => {
    const sc = document.getElementById('screen');
    const r = sc ? sc.getBoundingClientRect() : null;
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  });
  console.log('Canvas Box:', JSON.stringify(canvasBox));

  // Application launcher icon is at the bottom left of the panel:
  // e.g., x = canvasBox.x + 24, y = canvasBox.y + canvasBox.h - 20
  const launcherX = Math.round(canvasBox.x + 24);
  const launcherY = Math.round(canvasBox.y + canvasBox.h - 20);

  console.log(`Clicking Application Launcher at (${launcherX}, ${launcherY})...`);
  await page.mouse.click(launcherX, launcherY);
  await page.waitForTimeout(2000);

  let shot1 = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1\\02-application-launcher.png';
  await page.screenshot({ path: shot1 });
  console.log('Saved launcher screenshot:', shot1);

  // Check windows
  const wins1 = await page.evaluate(() => window.rvDisplay ? window.rvDisplay.windows() : []);
  console.log('Windows after launcher click:', JSON.stringify(wins1));

  // Dolphin icon is adjacent to launcher, approx x + 80, y = bottom - 20
  const dolphinX = Math.round(canvasBox.x + 85);
  const dolphinY = Math.round(canvasBox.y + canvasBox.h - 20);
  console.log(`Clicking Dolphin Icon at (${dolphinX}, ${dolphinY})...`);
  await page.mouse.click(dolphinX, dolphinY);
  await page.waitForTimeout(4000);

  let shot2 = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1\\05-dolphin-home.png';
  await page.screenshot({ path: shot2 });
  console.log('Saved dolphin screenshot:', shot2);

  const wins2 = await page.evaluate(() => window.rvDisplay ? window.rvDisplay.windows() : []);
  console.log('Windows after Dolphin click:', JSON.stringify(wins2));

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
