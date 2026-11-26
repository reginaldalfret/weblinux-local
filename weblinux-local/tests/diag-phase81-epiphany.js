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
    const chunks = b64.match(/.{1,120}/g) || [];
    await window.weblinuxAdapter.runCommand('rm -f /ubuntu/tmp/p81.b64', 10000);
    for (const c of chunks) {
      await window.weblinuxAdapter.runCommand(`printf '%s' '${c}' >> /ubuntu/tmp/p81.b64`, 10000);
    }
    await window.weblinuxAdapter.runCommand('base64 -d /ubuntu/tmp/p81.b64 > /ubuntu/tmp/p81-cmd.sh && chmod +x /ubuntu/tmp/p81-cmd.sh', 10000);
    return await window.weblinuxAdapter.runCommand('ubuntu-kde /bin/bash /tmp/p81-cmd.sh', timeoutMs);
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
  await page.waitForTimeout(105000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p81-01-plasma-ready.png') });

  const prep = await guestRun(page, `
rm -f /root/epiphany.log
export GDK_BACKEND=wayland WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/tmp/runtime-root
export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus
export JSC_useJIT=0 WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 WEBKIT_DISABLE_DMABUF_RENDERER=1
export WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 NO_AT_BRIDGE=1 GTK_A11Y=none GSK_RENDERER=cairo
mkdir -p -m 700 "$XDG_RUNTIME_DIR" "$HOME/.local/share/epiphany" "$HOME/.config/epiphany" "$HOME/Downloads"
(/usr/bin/epiphany https://example.com; echo "EPI_EXIT=$?") >/root/epiphany.log 2>&1 </dev/null &
sleep 1
echo LAUNCHED_EPI
`, 25000);
  console.log('1. Epiphany Launch:\n' + (prep.stdout || prep.output || '').trim());

  await page.waitForTimeout(95000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p81-02-epiphany-95s.png') });
  const end = await guestRun(page, `
ps -ef | grep -iE 'epiphany|WebKit' | grep -v grep || true
echo "---HISTORY_DB---"
python3 -c "import sqlite3; c=sqlite3.connect('/root/.local/share/epiphany/ephy-history.db'); print(c.execute('SELECT url, title, visit_count FROM urls').fetchall())" 2>&1 || true
echo "---EPI_LOG---"
tail -n 25 /root/epiphany.log 2>/dev/null || true
echo "---MEM---"
free -m
`, 25000);
  console.log('2. Epiphany at +95s:\n' + (end.stdout || end.output || '').trim());

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1500);
  await browser.close();
})();
