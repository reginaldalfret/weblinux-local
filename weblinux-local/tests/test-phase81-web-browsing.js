const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/ASUS/.gemini/antigravity/brain/a792fb87-9829-4a98-b5f8-e754a1f9dfa1';

async function waitForBoot(page, timeoutSec = 90) {
  for (let i = 0; i < timeoutSec; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
      waylandActive: window.weblinuxAdapter?.status?.waylandActive,
      error: window.weblinuxAdapter?.status?.error,
    }));
    if (st.error) throw new Error('Boot error: ' + st.error);
    if (st.state === 'running' && st.shellReady) return st;
  }
  throw new Error('Timed out waiting for guest shellReady');
}

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(400);
  await page.locator('div:has-text("Ubuntu 24.04.5 LTS KDE + Epiphany Web")').last().click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(300);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();

  await waitForBoot(page, 120);
  console.log('1. Booted. Waiting 105s for Plasma desktop...');
  await page.waitForTimeout(105000);

  const launchScript = [
    '#!/bin/bash',
    'cat <<\'HTML\' > /tmp/js.html',
    '<!DOCTYPE html><html><body style="background:#0f172a;color:#fff;font-family:sans-serif;padding:24px">',
    '<h1 id="d">NOJS</h1><div id="p">NOP</div><canvas id="c" width="320" height="100"></canvas>',
    '<script>d.textContent="JS_DOM_OK: "+navigator.userAgent.slice(0,42);',
    'Promise.resolve(JSON.parse(\'{"v":6}\')).then(o=>{p.textContent="PROMISE_JSON_OK: WebKitGTK "+o.v});',
    'x=c.getContext("2d");x.fillStyle="#22c55e";x.fillRect(0,0,320,100);',
    'x.fillStyle="#000";x.font="bold 22px sans-serif";x.fillText("CANVAS_2D_OK",60,58);</script></body></html>',
    'HTML',
    'export GDK_BACKEND=wayland WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/tmp/runtime-root',
    'export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus',
    'export JSC_useJIT=0 WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 WEBKIT_DISABLE_DMABUF_RENDERER=1',
    'export WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 NO_AT_BRIDGE=1 GTK_A11Y=none GSK_RENDERER=cairo',
    '(/usr/lib/riscv64-linux-gnu/webkitgtk-6.0/MiniBrowser file:///tmp/js.html; echo "MB_EXIT=$?") >/root/mb.log 2>&1 </dev/null &',
    'sleep 1; echo LAUNCHED_JS'
  ].join('\n');

  const res = await page.evaluate(async (txt) => {
    const b64 = btoa(txt);
    const parts = b64.match(/.{1,120}/g) || [];
    await window.weblinuxAdapter.runCommand('rm -f /ubuntu/tmp/mb.b64', 10000);
    for (const part of parts) {
      await window.weblinuxAdapter.runCommand(`printf %s ${part} >> /ubuntu/tmp/mb.b64`, 10000);
    }
    await window.weblinuxAdapter.runCommand('base64 -d /ubuntu/tmp/mb.b64 > /ubuntu/tmp/mb.sh && chmod +x /ubuntu/tmp/mb.sh', 10000);
    return await window.weblinuxAdapter.runCommand('ubuntu-kde /bin/bash /tmp/mb.sh', 20000);
  }, launchScript);
  console.log('2. Launch:', (res.stdout || res.output || '').trim());

  await page.waitForTimeout(70000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p81-02-js-canvas.png') });

  const stats = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ubuntu-kde /bin/bash -c "ps -ef | grep -iE \'MiniBrowser|WebKit\' | grep -v grep; free -m"', 15000);
  });
  console.log('3. Stats:\n' + (stats.stdout || stats.output || '').trim());

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1500);
  await browser.close();
})();
