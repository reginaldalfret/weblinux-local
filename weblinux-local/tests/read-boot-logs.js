const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-features=SharedArrayBuffer'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await page.waitForTimeout(5000);

  const readLog = async (path) => {
    const res = await page.evaluate(p => window.weblinuxAdapter.runCommand(`cat ${p} 2>/dev/null`, 5000), path);
    console.log(`\n=== LOG: ${path} ===`);
    console.log((res.stdout || res.out || '').trim());
  };

  await readLog('/root/wlserver.log');
  await readLog('/root/desktop.log');
  await readLog('/root/desktop-status.log');
  await readLog('/tmp/konsole-gui.log');
  await readLog('/tmp/dolphin-gui.log');

  await browser.close();
})().catch(console.error);
