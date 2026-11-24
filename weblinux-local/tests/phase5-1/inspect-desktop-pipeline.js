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
  await page.waitForTimeout(15000);

  const run = async (cmd) => {
    return await page.evaluate(async (c) => {
      const res = await window.weblinuxAdapter.runCommand(c, 15000);
      return res.stdout || res.out || '';
    }, cmd);
  };

  const outputs = {};

  console.log('Fetching /bin/debian...');
  outputs['/bin/debian'] = await run('cat /bin/debian');

  console.log('Fetching /debian/etc/rvwasm/autostart...');
  outputs['autostart'] = await run('cat /debian/etc/rvwasm/autostart');

  console.log('Fetching /debian/usr/local/bin/desktop...');
  outputs['desktop'] = await run('cat /debian/usr/local/bin/desktop');

  console.log('Running debian which konsole dolphin...');
  outputs['which'] = await run('debian which konsole dolphin kwin_wayland plasmashell gnome-shell mutter labwc xfce4-session xfce4-panel xfdesktop thunar nautilus Xwayland weston 2>&1 || true');

  console.log('Running debian cat /etc/os-release...');
  outputs['os_release'] = await run('debian cat /etc/os-release');

  console.log('Running debian ls -la /usr/share/wayland-sessions...');
  outputs['wayland_sessions'] = await run('debian ls -la /usr/share/wayland-sessions/ 2>/dev/null || echo NONE');

  console.log('Running debian ls -la /usr/share/xsessions...');
  outputs['xsessions'] = await run('debian ls -la /usr/share/xsessions/ 2>/dev/null || echo NONE');

  fs.writeFileSync(path.resolve(__dirname, 'pipeline-inspection.json'), JSON.stringify(outputs, null, 2));
  console.log('Inspection complete! Saved to pipeline-inspection.json');

  await context.close();
})().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});
