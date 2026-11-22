const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve(__dirname, '.test-user-data');

async function test() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    userDataDir: USER_DATA_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-features=SharedArrayBuffer']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
    if (btn) btn.click();
  });

  // wait for shell
  while (true) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await page.evaluate(() => {
      const a = window.weblinuxAdapter;
      return a ? { out: a.getOutput(), ready: a.getStatus().shellReady } : null;
    });
    if (res && (res.ready || res.out.includes('# '))) break;
    await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.sendInput('\r'));
  }

  // 1. Check full desktop launcher script
  const scriptContent = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/usr/local/bin/desktop', 15000);
  });
  console.log('--- /debian/usr/local/bin/desktop ---');
  console.log(scriptContent.out);

  // 2. Check Xwayland
  const xwaylandCheck = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ls -la /debian/usr/bin/Xwayland /debian/usr/local/bin/Xwayland', 15000);
  });
  console.log('--- Xwayland check ---');
  console.log(xwaylandCheck.out);

  // 3. Check KDE Plasma processes and Wayland
  const psCheck = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ps', 15000);
  });
  console.log('--- ps output ---');
  console.log(psCheck.out);

  // 4. Check autostart.log
  const autostartLog = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/root/autostart.log', 15000);
  });
  console.log('--- /debian/root/autostart.log ---');
  console.log(autostartLog.out);

  // 5. Check wlserver log
  const wlserverLog = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/root/wlserver.log', 15000);
  });
  console.log('--- /debian/root/wlserver.log ---');
  console.log(wlserverLog.out);

  await page.evaluate(async () => {
    await window.weblinuxAdapter.shutdown();
  });
  await browser.close();
}
test().catch(console.error);
