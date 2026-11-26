const { chromium } = require('playwright');

async function waitForBoot(page, timeoutSec = 120) {
  for (let i = 0; i < timeoutSec; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
      error: window.weblinuxAdapter?.status?.error,
    }));
    if (st.error) throw new Error('Boot error: ' + st.error);
    if (st.state === 'running' && st.shellReady) return st;
  }
  throw new Error('Timed out');
}

(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'] });
  const p = await (await b.newContext()).newPage();
  await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
  await p.click('button:has-text("Distributions")');
  await p.waitForTimeout(400);
  await p.locator('div:has-text("Arch Linux RISC-V (Community Port + KDE Plasma 6)")').last().click();
  await p.waitForTimeout(300);
  await p.locator('button:has-text("Configure Desktop")').click();
  await p.waitForTimeout(300);
  await p.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();

  await waitForBoot(p, 120);
  await p.waitForTimeout(5000);

  const diag = await p.evaluate(async () => {
    const cmd = `killall -9 plasmashell kbuildsycoca6 2>/dev/null; arch-root env GALLIUM_DRIVER=virpipe VTEST_SOCKET_NAME=/tmp/runtime-root/rvgpu-0 QSG_INFO=1 QSG_RENDER_LOOP=basic QT_LOGGING_RULES=qt.rhi.*=true timeout 45 plasmashell --no-respawn 2>&1; echo PLASMA_RC=$?; tail -n 15 /arch/root/rvgpu.log 2>&1`;
    return await window.weblinuxAdapter.runCommand(cmd, 65000);
  });
  console.log('QT6 RVGPU DIAG:\n' + (diag.stdout || diag.output || ''));

  const caps = await p.evaluate(() => ({
    caps: window.weblinuxAdapter?.getGraphicsCapabilities?.(),
    stats: window.gpuExecStats || null,
  }));
  console.log('CAPS:', JSON.stringify(caps, null, 2));

  await p.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await b.close();
})();
