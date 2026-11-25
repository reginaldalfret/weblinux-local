const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE = path.resolve(__dirname, '.edge-live-profile-clean');

async function check() {
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
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // Click Launch
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
    if (btn) btn.click();
  });

  // Wait for shell ready
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const status = await page.evaluate(() => window.weblinuxAdapter ? window.weblinuxAdapter.getStatus() : null);
    if (status && status.shellReady) break;
  }

  console.log('Shell ready. Querying guest logs...');
  await new Promise(r => setTimeout(r, 2000));

  const autostart = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/root/autostart.log || ls -la /debian/root', 10000);
  });
  console.log('[autostart.log]:\n', autostart.out);

  const wlserver = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/root/wlserver.log || ls -la /root', 10000);
  });
  console.log('[wlserver.log]:\n', wlserver.out);

  const ps = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ps', 10000);
  });
  console.log('[ps]:\n', ps.out);

  const desktopTest = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('/bin/debian /etc/rvwasm/autostart', 10000);
  });
  console.log('[/etc/rvwasm/autostart manual run]:\n', desktopTest.out);

  await new Promise(r => setTimeout(r, 4000));

  const shot = path.resolve(__dirname, 'screenshots/local-launch/guest-logs-desktop.png');
  await page.screenshot({ path: shot });
  console.log('Screenshot saved to:', shot, fs.statSync(shot).size, 'bytes');

  browser.disconnect();
}

check().catch(console.error);
