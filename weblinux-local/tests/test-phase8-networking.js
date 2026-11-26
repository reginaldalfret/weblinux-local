const { chromium } = require('playwright');

async function testDistro(page, distroName, desktopName, prefix) {
  console.log(`\n=== Testing Guest Networking on ${distroName} ===`);
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const chooseBtn = page.locator('text=Choose Distribution').first();
  if (await chooseBtn.isVisible()) await chooseBtn.click();
  else await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(500);
  await page.locator(`div:has-text("${distroName}")`).last().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(500);
  await page.locator(`div:has-text("${desktopName}")`).first().click();
  await page.waitForTimeout(300);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();

  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
    }));
    if (st.state === 'running' && st.shellReady) break;
  }

  const hostNet = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ifconfig eth0 && route -n', 15000);
  });
  console.log('Host BusyBox eth0/route:\n' + (hostNet.stdout || hostNet.out || '').trim());

  const guestNet = await page.evaluate(async (pfx) => {
    const dir = pfx.startsWith('ubuntu') ? '/ubuntu' : '/debian';
    const py = [
      'import socket, urllib.request',
      'print("DNS:", socket.gethostbyname("example.com"))',
      'r = urllib.request.urlopen("https://example.com", timeout=15)',
      'body = r.read(400).decode("utf-8", "ignore")',
      'print("HTTPS_STATUS:", r.status, "TITLE_OK:", "Example Domain" in body)',
      'try:',
      '    urllib.request.urlopen("http://192.168.1.1", timeout=3)',
      '    print("RFC1918_BLOCK: FAILED")',
      'except Exception as e:',
      '    print("RFC1918_BLOCK: OK", type(e).__name__)',
    ].join('\n');
    const b64 = btoa(py);
    await window.weblinuxAdapter.runCommand(`echo ${b64} | base64 -d > ${dir}/tmp/test-net.py`, 10000);
    return await window.weblinuxAdapter.runCommand(`${pfx} python3 /tmp/test-net.py`, 25000);
  }, prefix);
  console.log('Guest Python3 DNS+HTTPS+RFC1918:\n' + (guestNet.stdout || guestNet.out || '').trim());

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1000);
}

(async () => {
  const b = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
  });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();

  await testDistro(p, 'Ubuntu Noble Numbat', 'Ubuntu KDE Plasma', 'ubuntu-kde');
  await testDistro(p, 'Trixie', 'KDE Plasma', 'debian');

  await b.close();
})();
