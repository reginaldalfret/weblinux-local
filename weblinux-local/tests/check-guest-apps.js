const { chromium } = require('playwright');

(async () => {
  console.log('=== AUDITING DEBIAN GUEST APPLICATIONS & KDE PLASMA ===');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: [
      '--enable-features=SharedArrayBuffer',
      '--use-gl=angle',
      '--use-angle=default'
    ]
  });

  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  page.on('console', msg => {
    const t = msg.text();
    if (t.includes('display:') || t.includes('plasma:') || t.includes('splash:')) {
      console.log('  [Console]', t);
    }
  });

  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');
  console.log('Waiting for guest to reach running state...');

  let ready = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => {
      const ad = window.weblinuxAdapter;
      return ad ? { state: ad.status.state, wayland: ad.status.waylandActive, uptime: ad.status.uptimeSeconds } : null;
    });
    if (state && state.state === 'running' && state.wayland) {
      console.log(`Guest is ready at T+${i}s:`, JSON.stringify(state));
      ready = true;
      break;
    }
  }

  if (!ready) {
    console.error('Guest did not reach running state within 40s');
    await browser.close();
    process.exit(1);
  }

  // Allow desktop/plasma to settle
  await page.waitForTimeout(5000);

  const commands = [
    'uname -a',
    'cat /etc/os-release',
    'which konsole dolphin kate bash sh',
    'ls -la /usr/bin/*terminal* /usr/bin/*konsole* /usr/bin/*dolphin* /usr/bin/*fm* 2>/dev/null',
    'ls -la /usr/share/applications/*.desktop | head -n 30',
    'ps aux',
    'echo "DISPLAY=$DISPLAY WAYLAND_DISPLAY=$WAYLAND_DISPLAY XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR"'
  ];

  for (const cmd of commands) {
    console.log(`\n--- EXECUTING: ${cmd} ---`);
    const res = await page.evaluate(async (c) => {
      return await window.weblinuxAdapter.runCommand(c, 15000);
    }, cmd);
    console.log('EXIT CODE:', res.exitCode !== undefined ? res.exitCode : res.rc);
    console.log('OUTPUT:\n' + (res.stdout || res.out || '').trim());
  }

  await browser.close();
  console.log('\n=== AUDIT COMPLETE ===');
})().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
