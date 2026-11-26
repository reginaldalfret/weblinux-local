const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer', '--enable-unsafe-webgpu'],
  });
  const p = await b.newPage();
  p.on('console', m => {
    const t = m.text();
    if (t.includes('gpu') || t.includes('vrend') || t.includes('rvgpu') || t.includes('Error') || t.includes('Failed')) {
      console.log('[CONSOLE]', t);
    }
  });
  p.on('pageerror', e => console.log('[PAGEERROR]', e.message));
  await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  await p.locator('button:has-text("Configure & Launch Ubuntu")').first().click();
  await p.waitForTimeout(500);
  await p.locator('button[data-testid="launch-desktop-btn"]').first().click();
  for (let i = 0; i < 45; i++) {
    await p.waitForTimeout(1000);
    const s = await p.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      rvTabId: window.rvTabId,
      stats: window.rvGpu?.stats,
    }));
    if (i % 5 === 0 || (s.stats && s.stats.exec_kind)) {
      console.log('[' + i + 's]', JSON.stringify(s));
    }
    if (i >= 35 && s.state === 'running') break;
  }
  const rvLog = await p.evaluate(async () => {
    const r = await window.weblinuxAdapter.runCommand('cat /ubuntu/root/rvgpu.log /ubuntu/root/ubuntu-kde-session.log 2>/dev/null || true', 10000);
    return (r.stdout || r.out || '').trim();
  });
  console.log('GUEST LOGS:\n' + rvLog);
  await p.locator('button:has-text("Power Off")').first().click();
  await p.waitForTimeout(2000);
  await b.close();
})();
