const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const PROFILE_DIR = path.resolve(__dirname, '.audit-edge-profile');
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=SharedArrayBuffer', '--no-sandbox']
  });
  const page = context.pages()[0] || await context.newPage();
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  await page.click('button:has-text("Launch WebLinux")');
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await page.waitForTimeout(10000);

  const run = async (cmd) => {
    return await page.evaluate(async (c) => {
      const res = await window.weblinuxAdapter.runCommand(c, 20000);
      return res.stdout || res.out || '';
    }, cmd);
  };

  const results = {};
  console.log('Checking /etc/apt/sources.list...');
  results['sources.list'] = await run('debian cat /etc/apt/sources.list');

  console.log('Checking apt-cache search labwc...');
  results['apt_labwc'] = await run('debian apt-cache search labwc');

  console.log('Checking apt-cache search xfce4-session...');
  results['apt_xfce4'] = await run('debian apt-cache search xfce4-session');

  console.log('Checking apt-cache search mutter...');
  results['apt_mutter'] = await run('debian apt-cache search mutter');

  console.log('Checking weston version and help...');
  results['weston'] = await run('debian weston --version 2>&1');

  fs.writeFileSync(path.resolve(__dirname, 'package-audit.json'), JSON.stringify(results, null, 2));
  console.log('Saved to package-audit.json');

  await context.close();
})().catch(err => {
  console.error('Audit error:', err);
  process.exit(1);
});
