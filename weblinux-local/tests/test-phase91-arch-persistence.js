const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/ASUS/.gemini/antigravity/brain/a792fb87-9829-4a98-b5f8-e754a1f9dfa1';
const PROFILE_DIR = path.join(__dirname, '..', '.tmp-edge-p91-profile');

async function waitForBoot(page, timeoutSec = 120) {
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

async function launchArch(page) {
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(400);
  await page.locator('div:has-text("Arch Linux RISC-V (Community Port + KDE Plasma 6)")').last().click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(300);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();
  return await waitForBoot(page, 120);
}

(async () => {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1400, height: 900 },
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  const testId = `P91_ARCH_PERSIST_${Date.now()}`;
  console.log('=== PHASE A: First Boot in Persistent BrowserContext ===');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const stA = await launchArch(page);
  console.log('Boot A:', stA);

  const setupRes = await page.evaluate(async (id) => {
    const cmd = `mount | grep wd; dmesg | grep -iE "wd|ext4" | tail -n 6; arch-root /bin/bash -c 'echo HOME=$HOME; python3 -c "import hashlib,time; hdr=b\\"${id}\\\\nTS=\\" + str(time.time()).encode() + b\\"\\\\n\\"; data=hdr + b\\"0123456789ABCDEF\\"*1024; open(\\"/root/p91-persist-test.dat\\",\\"wb\\").write(data); print(\\"WROTE_BYTES=\\",len(data)); print(\\"EXPECTED_SHA256=\\",hashlib.sha256(data).hexdigest())"; sync; sync'`;
    return await window.weblinuxAdapter.runCommand(cmd, 60000);
  }, testId);
  const outA = setupRes.stdout || setupRes.output || '';
  console.log('Phase A output:\n' + outA.trim());
  const match = outA.match(/EXPECTED_SHA256=\s*([0-9a-f]{64})/);
  if (!match) throw new Error('Failed to compute EXPECTED_SHA256 in Phase A');
  const expectedSha = match[1];

  console.log('=== Power Off A ===');
  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(2000);

  console.log('=== PHASE B: Restart Arch in Same Persistent BrowserContext ===');
  const stB = await launchArch(page);
  console.log('Boot B:', stB);

  const verifyB = await page.evaluate(async () => {
    const cmd = `mount | grep wd; dmesg | grep -iE "wd|ext4" | tail -n 8; arch-root /bin/bash -c 'ls -la /root/p91-persist-test.dat; sha256sum /root/p91-persist-test.dat; head -n 2 /root/p91-persist-test.dat; echo RELOAD_MARKER_91 > /root/p91-reload.txt; sync; sync'`;
    return await window.weblinuxAdapter.runCommand(cmd, 60000);
  });
  const outB = verifyB.stdout || verifyB.output || '';
  console.log('Phase B output:\n' + outB.trim());
  if (!outB.includes(expectedSha)) {
    throw new Error(`Phase B SHA256 mismatch! Expected ${expectedSha}`);
  }
  if (outB.includes('EXT4-fs error')) {
    throw new Error('Phase B detected EXT4-fs error on warm reboot!');
  }

  console.log('=== Power Off B & Normal Browser Page Reload ===');
  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  console.log('=== PHASE C: Boot Arch After Normal Page Reload ===');
  const stC = await launchArch(page);
  console.log('Boot C:', stC);

  await page.waitForTimeout(3000);
  const verifyC = await page.evaluate(async () => {
    const cmd = `mount | grep wd; dmesg | grep -iE "wd|ext4" | tail -n 8; cat /arch/root/p91-reload.txt; arch-root /bin/sha256sum /root/p91-persist-test.dat`;
    return await window.weblinuxAdapter.runCommand(cmd, 60000);
  });
  const outC = verifyC.stdout || verifyC.output || '';
  console.log('Phase C meta:', { rc: verifyC.rc, timedOut: verifyC.timedOut, stderr: verifyC.stderr });
  console.log('Phase C output:\n' + outC.trim());
  if (!outC.includes(expectedSha) || !outC.includes('RELOAD_MARKER_91')) {
    throw new Error('Phase C persistence after page reload failed!');
  }
  if (outC.includes('EXT4-fs error')) {
    throw new Error('Phase C detected EXT4-fs error after page reload!');
  }

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p91-01-persistence-check.png') });
  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1500);
  await ctx.close();
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  console.log('ALL PERSISTENCE CHECKS PASSED. EXPECTED_SHA256=' + expectedSha);
})();
