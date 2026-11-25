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

async function guestRun(page, scriptText, timeoutMs = 30000) {
  const b64 = Buffer.from(scriptText, 'utf8').toString('base64');
  return await page.evaluate(async ({ b64, timeoutMs }) => {
    await window.weblinuxAdapter.runCommand(`echo ${b64} | base64 -d > /ubuntu/tmp/p8-cmd.sh && chmod +x /ubuntu/tmp/p8-cmd.sh`, 15000);
    return await window.weblinuxAdapter.runCommand('ubuntu-kde /bin/bash /tmp/p8-cmd.sh', timeoutMs);
  }, { b64, timeoutMs });
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
  console.log('1. Booted. Building fontconfig cache & waiting for Plasma...');
  const fc = await guestRun(page, `fc-cache -f && echo FC_DONE`, 45000);
  console.log('fc-cache:', (fc.stdout || fc.output || '').trim());

  await page.waitForTimeout(35000);

  console.log('2. Launching Epiphany on https://example.com ...');
  const launch = await guestRun(page, `
export GDK_BACKEND=wayland WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/tmp/runtime-root
export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus
export JSC_useJIT=0 WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 WEBKIT_DISABLE_DMABUF_RENDERER=1
export LIBGL_ALWAYS_SOFTWARE=1 NO_AT_BRIDGE=1 GTK_A11Y=none GSK_RENDERER=cairo
mkdir -p -m 700 "$XDG_RUNTIME_DIR" "$HOME/.local/share/epiphany" "$HOME/.config/epiphany" "$HOME/Downloads"
nohup /usr/bin/epiphany https://example.com >/root/epiphany.log 2>&1 </dev/null &
sleep 1
echo LAUNCHED
`, 20000);
  console.log('Launch:', (launch.stdout || launch.output || '').trim());

  await page.waitForTimeout(95000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p8-02a-epiphany-95s.png') });
  // Click "Wait" if "Page Unresponsive" or "No" if "Set as Default Browser?"
  const canvas = page.locator('#screen');
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.31, box.y + box.height * 0.60);
    await page.waitForTimeout(500);
    await page.mouse.click(box.x + box.width * 0.38, box.y + box.height * 0.65);
  }
  await page.waitForTimeout(45000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p8-02-epiphany-after-fccache.png') });

  const info = await guestRun(page, `
ps -ef | grep -iE 'epiphany|WebKit' | grep -v grep || true
WKP=$(pgrep -n WebKitWebProcess || true); [ -n "$WKP" ] && echo "WKP_WCHAN=$(cat /proc/$WKP/wchan 2>/dev/null)"
NKP=$(pgrep -n WebKitNetworkProcess || true); [ -n "$NKP" ] && echo "NKP_WCHAN=$(cat /proc/$NKP/wchan 2>/dev/null)"
echo "---HISTORY---"
python3 -c "import sqlite3; c=sqlite3.connect('/root/.local/share/epiphany/ephy-history.db'); print(c.execute('SELECT url, title, visit_count FROM urls').fetchall())" 2>&1 || true
echo "---LOG---"
tail -n 20 /root/epiphany.log 2>/dev/null || true
`, 25000);
  console.log('3. State:\n' + (info.stdout || info.output || '').trim());

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1500);
  await browser.close();
})();
