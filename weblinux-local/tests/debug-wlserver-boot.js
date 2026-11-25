const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE = path.resolve(__dirname, `.edge-profile-debug-${Date.now()}`);

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: false,
    userDataDir: PROFILE,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-features=SharedArrayBuffer',
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=default',
      '--window-size=1440,900',
    ],
  });

  const page = (await browser.pages())[0];

  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('requestAnimationFrame') && !text.includes('pointer')) {
      console.log(`[CONSOLE] ${msg.type()}: ${text}`);
    }
  });

  page.on('pageerror', err => {
    console.error(`[PAGEERROR]:`, err);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  console.log('Waiting for "Launch WebLinux" button...');
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Launch WebLinux'));
  }, { timeout: 15000 });

  // Click Launch WebLinux
  console.log('Clicking "Launch WebLinux"...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
    if (btn) btn.click();
  });

  // Wait for shell ready
  console.log('Waiting for boot...');
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const isReady = await page.evaluate(() => {
      const a = window.weblinuxAdapter;
      return a && a.getStatus && a.getStatus().shellReady;
    });
    if (isReady) {
      console.log('Kernel booted and shell ready!');
      break;
    }
  }

  // Check guest logs and processes
  console.log('\n--- Checking Guest Filesystem ---');
  const r1 = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ls -la /debian/root; cat /debian/root/autostart.log', 15000);
  });
  console.log('[autostart.log]:\n', r1.out);

  const r2 = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/root/wlserver.log', 15000);
  });
  console.log('[wlserver.log]:\n', r2.out);

  const r3 = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ps', 15000);
  });
  console.log('[ps]:\n', r3.out);

  // Check if wlserver or autostart can be run directly
  console.log('\n--- Checking /debian/etc/rvwasm/autostart ---');
  const r4 = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/etc/rvwasm/autostart', 15000);
  });
  console.log('[autostart script content]:\n', r4.out);

  // What does /bin/debian desktop wayland plasma-native output?
  console.log('\n--- Starting /bin/debian /etc/rvwasm/autostart in guest ---');
  const r5 = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('/bin/debian /etc/rvwasm/autostart &', 15000);
  });
  console.log('[autostart run output]:\n', r5.out);

  await new Promise(r => setTimeout(r, 5000));

  const r6 = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/root/autostart.log; cat /debian/root/wlserver.log; ps', 15000);
  });
  console.log('[post-run logs]:\n', r6.out);

  // Check display.js active state
  const disp = await page.evaluate(() => {
    return {
      active: window.rvDisplay ? window.rvDisplay.active() : false,
      stats: window.rvDisplay ? window.rvDisplay.stats : null,
      rvTabId: window.rvTabId,
    };
  });
  console.log('[rvDisplay status]:', JSON.stringify(disp, null, 2));

  // Take screenshot
  const shot = path.resolve(__dirname, 'screenshots/local-launch/debug-wlserver-shot.png');
  await page.screenshot({ path: shot });
  console.log('Saved screenshot:', shot);

  // Keep alive for 30 seconds so we can see
  console.log('Keeping browser open for 30s...');
  await new Promise(r => setTimeout(r, 30000));

  browser.disconnect();
}

main().catch(console.error);
