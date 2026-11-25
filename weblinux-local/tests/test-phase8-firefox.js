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

async function guestRun(page, scriptText, timeoutMs = 25000) {
  const b64 = Buffer.from(scriptText, 'utf8').toString('base64');
  return await page.evaluate(async ({ b64, timeoutMs }) => {
    await window.weblinuxAdapter.runCommand(`echo ${b64} | base64 -d > /debian/tmp/p8-ff.sh && chmod +x /debian/tmp/p8-ff.sh`, 10000);
    return await window.weblinuxAdapter.runCommand('debian /bin/bash /tmp/p8-ff.sh', timeoutMs);
  }, { b64, timeoutMs });
}

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  console.log('1. Navigating to http://localhost:3000 and selecting Debian 13 + Firefox ESR...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(500);
  await page.locator('div:has-text("Debian GNU/Linux 13 (Trixie) + Firefox ESR")').last().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(400);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();

  const st = await waitForBoot(page, 120);
  const bootSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`2. Booted in ${bootSec}s:`, st);

  await page.waitForTimeout(25000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p8-03-debian-firefox-desktop.png') });

  const preflight = await guestRun(page, `
killall -9 plasmashell kded5 kiod5 2>/dev/null || true
sleep 2
sync; echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
free -m
cat /proc/buddyinfo
ls -lh /usr/lib/firefox-esr/libxul.so
which firefox-esr browser
`);
  console.log('3. Preflight:\n' + (preflight.stdout || preflight.output || JSON.stringify(preflight)));

  console.log('4. Launching Firefox ESR via /usr/local/bin/browser https://example.com ...');
  const launchRes = await guestRun(page, `
rm -f /root/firefox.log
# Check actual Wayland socket path on Debian KDE
WL_SOCK=$(find /tmp /run -maxdepth 3 -name 'wayland-*' 2>/dev/null | head -n 1)
echo "WL_SOCK=$WL_SOCK"
if [ -n "$WL_SOCK" ]; then
  export XDG_RUNTIME_DIR="$(dirname "$WL_SOCK")"
  export WAYLAND_DISPLAY="$(basename "$WL_SOCK")"
fi
export GDK_BACKEND=wayland MOZ_ENABLE_WAYLAND=1
export MOZ_DISABLE_CONTENT_SANDBOX=1 MOZ_DISABLE_GMP_SANDBOX=1 MOZ_DISABLE_RDD_SANDBOX=1
export MOZ_CRASHREPORTER_DISABLE=1 JS_DISABLE_JIT=1 NO_AT_BRIDGE=1 GTK_A11Y=none
export MOZ_LOG="Process:4,WidgetWayland:4"
mkdir -p /root/browser-home/.mozilla /root/browser-home/Downloads
HOME=/root/browser-home nohup /usr/bin/firefox-esr --no-remote https://example.com >/root/firefox.log 2>&1 </dev/null &
sleep 1
echo LAUNCH_RC=$?
`);
  console.log('Launch:', (launchRes.stdout || launchRes.output || JSON.stringify(launchRes)));

  for (let w = 0; w < 4; w++) {
    await page.waitForTimeout(15000);
    const snap = await guestRun(page, `ps -ef | grep -iE 'firefox|gecko' | grep -v grep || true; echo "---LOG_TAIL---"; tail -n 20 /root/firefox.log 2>/dev/null || true`, 15000);
    const out = (snap.stdout || snap.output || '').trim();
    console.log(`[t+${(w + 1) * 15}s]\n` + out);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p8-04-debian-firefox-example.png') });

  const memRes = await guestRun(page, `free -m`);
  console.log('5. Memory:\n' + (memRes.stdout || memRes.output || '').trim());

  console.log('6. Shutting down...');
  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1500);
  await browser.close();
  console.log('DONE.');
})();
