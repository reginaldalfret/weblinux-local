/**
 * WebLinux Local — Phase 2: Live Browser Range vs Chunk Boot Benchmark (Microsoft Edge)
 */
const { chromium } = require('playwright');
const assert = require('assert');

async function run() {
  console.log('=== PHASE 2: LIVE BROWSER RANGE VS CHUNK BENCHMARK ===');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  let rangeReqCount = 0;
  let rangeBytes = 0;
  let chunkReqCount = 0;
  let chunkBytes = 0;

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/disk/ubuntu-24.04/rootfs.img') && res.status() === 206) {
      rangeReqCount++;
      const cl = Number(res.headers()['content-length'] || 0);
      rangeBytes += cl;
    } else if (/\/disk\/ubuntu-24\.04\/\d{6}$/.test(url) && res.status() === 200) {
      chunkReqCount++;
      const cl = Number(res.headers()['content-length'] || 0);
      chunkBytes += cl;
    }
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  // Select Ubuntu CLI and boot
  const chooseBtn = page.locator('text=Choose Distribution').first();
  if (await chooseBtn.isVisible()) {
    await chooseBtn.click();
  } else {
    await page.click('button:has-text("Distributions"), a:has-text("Distributions")');
  }
  await page.waitForTimeout(800);
  await page.locator('div:has-text("Ubuntu Noble Numbat")').last().click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(500);
  await page.locator('div:has-text("Ubuntu CLI Shell")').last().click();
  await page.waitForTimeout(300);

  const coldStart = Date.now();
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();

  let shellTimeMs = 0;
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(500);
    const ready = await page.evaluate(() => {
      const a = window.weblinuxAdapter;
      return a && (a.status.shellReady || a.status.state === 'running');
    });
    if (ready) {
      shellTimeMs = Date.now() - coldStart;
      break;
    }
  }
  assert.ok(shellTimeMs > 0, 'Ubuntu CLI must reach shellReady');

  // Execute a real command inside Ubuntu to verify Range-loaded rootfs works
  const osRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ubuntu cat /etc/os-release | head -n 2', 10000);
  });
  assert.ok((osRes.stdout || '').includes('Ubuntu 24.04.5 LTS'), 'Guest Ubuntu /etc/os-release must be readable');

  const logs = await page.evaluate(() => window.weblinuxAdapter.logs || []);
  const rangeVerifiedLog = logs.some(l => l.includes('HTTP 206 Range verified'));

  const coldStats = { shellTimeMs, rangeReqCount, rangeBytes, chunkReqCount, chunkBytes, rangeVerifiedLog };
  console.log('Boot 1 (Range-enabled) Telemetry:', JSON.stringify(coldStats, null, 2));

  // Shutdown cleanly (using Phase 1 OP_SHUTDOWN) and measure warm-cache reboot
  await page.evaluate(async () => {
    await window.weblinuxAdapter.shutdown();
  });

  rangeReqCount = 0; rangeBytes = 0; chunkReqCount = 0; chunkBytes = 0;
  const warmStart = Date.now();
  await page.waitForTimeout(400);
  const chooseBtn2 = page.locator('text=Choose Distribution').first();
  if (await chooseBtn2.isVisible()) {
    await chooseBtn2.click();
  } else {
    await page.click('button:has-text("Distributions"), a:has-text("Distributions")');
  }
  await page.waitForTimeout(600);
  await page.locator('div:has-text("Ubuntu Noble Numbat")').last().click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(400);
  await page.locator('div:has-text("Ubuntu CLI Shell")').last().click();
  await page.waitForTimeout(200);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();

  let warmTimeMs = 0;
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(500);
    const ready = await page.evaluate(() => {
      const a = window.weblinuxAdapter;
      return a && (a.status.shellReady || a.status.state === 'running');
    });
    if (ready) {
      warmTimeMs = Date.now() - warmStart;
      break;
    }
  }
  assert.ok(warmTimeMs > 0, 'Warm reboot must reach shellReady');
  console.log('Boot 2 (Warm OPFS) Telemetry:', JSON.stringify({ warmTimeMs, rangeReqCount, rangeBytes, chunkReqCount, chunkBytes }, null, 2));

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await browser.close();
  console.log('=== PHASE 2 BROWSER RANGE BENCHMARK COMPLETE ===');
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
