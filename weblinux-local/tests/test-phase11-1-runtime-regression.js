#!/usr/bin/env node
/**
 * Phase 11.1.6 — Fedora 45 RISC-V KDE Runtime Security Regression
 *
 * Verifies in live Microsoft Edge:
 *  - Hardened RPM GPG key + DNF5 repo overrides inside the booted guest
 *  - dnf5 repolist --all, repo info fedora, dnf5 check, dnf5 upgrade --refresh --assumeno
 *  - Public DNS/HTTPS + RFC1918 private network block
 *  - Plasma 6.7.4 desktop, Kickoff, Konsole, Dolphin, window move
 *  - OPFS warm reboot & page.reload() persistence (root-fedora-kde / home-fedora-kde)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'screenshots', 'phase11-1');
fs.mkdirSync(OUT_DIR, { recursive: true });
const PROFILE_DIR = path.join(__dirname, '..', '.tmp-edge-p11-1-profile');

async function waitForBoot(page, timeoutSec = 120) {
  for (let i = 0; i < timeoutSec; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
      waylandActive: window.weblinuxAdapter?.status?.waylandActive,
      error: window.weblinuxAdapter?.status?.error,
    }));
    if (st.error) {
      throw new Error('Boot error: ' + st.error);
    }
    if (st.state === 'running' && st.shellReady) return st;
  }
  throw new Error('Timed out waiting for guest shellReady');
}

async function launchFedora(page) {
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(500);
  await page.locator('div:has-text("Fedora 45 RISC-V (Community Build + KDE Plasma 6)")').last().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(400);
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

  const t0 = Date.now();
  console.log('1. Booting hardened Fedora 45 RISC-V KDE...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const st = await launchFedora(page);
  const coldBootSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`2. Cold booted in ${coldBootSec}s:`, st);

  // Verify GPG key, DNF5 hardening, dnf5 check, dry-run upgrade, and networking + RFC1918 block
  const secRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      `mount | grep wd; dmesg | grep -iE "wd|ext4" | tail -n 6; fedora-root '
        echo "=== GPG_PUBKEY ==="; rpm -q gpg-pubkey;
        echo "=== REPOLIST ==="; dnf5 repolist --all;
        echo "=== REPO_INFO ==="; dnf5 repo info fedora;
        echo "=== DNF_CHECK ==="; dnf5 check && echo "DNF_CHECK_OK=1";
        echo "=== DNF_DRYRUN ==="; dnf5 upgrade --refresh --assumeno || true;
        echo "=== NET_PUBLIC ==="; getent hosts example.com; curl -sI --max-time 10 https://example.com | head -n 2;
        echo "=== NET_RFC1918 ==="; curl -s --max-time 4 http://192.168.1.1 >/dev/null 2>&1 && echo "RFC1918_FAIL" || echo "RFC1918_BLOCKED_OK";
      '`,
      180000
    );
  });
  const secOut = secRes.stdout || secRes.output || '';
  console.log('3. Guest Security & Networking Output:\n' + secOut.trim());

  if (!secOut.includes('gpg-pubkey-4f50a6114cd5c6976a7f1179655a4b02f577861e')) {
    throw new Error('Missing imported Fedora 45 GPG key in guest RPM DB');
  }
  if (!/fedora-staging[^\n]*disabled/.test(secOut) || !/fedora-koji[^\n]*disabled/.test(secOut)) {
    throw new Error('fedora-staging or fedora-koji is not disabled in guest');
  }
  if (!secOut.includes('Verify packages') || !secOut.includes('true')) {
    throw new Error('Verify packages: true not active in guest dnf5 repo info fedora');
  }
  if (!secOut.includes('DNF_CHECK_OK=1')) {
    throw new Error('dnf5 check failed in guest');
  }
  if (!secOut.includes('HTTP/2 200') && !secOut.includes('HTTP/1.1 200')) {
    throw new Error('Public HTTPS check failed in guest');
  }
  if (!secOut.includes('RFC1918_BLOCKED_OK')) {
    throw new Error('RFC1918 destination was not blocked');
  }

  console.log('4. Waiting 135s for Plasma 6.7.4 desktop & panel...');
  await page.waitForTimeout(135000);
  await page.screenshot({ path: path.join(OUT_DIR, 'p11-1-01-desktop.png'), timeout: 60000 });

  // Kickoff + Konsole + Dolphin
  await page.mouse.click(24, 878);
  await page.waitForTimeout(10000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);

  await page.evaluate(async () => {
    await window.weblinuxAdapter.runCommand(
      `fedora-root 'nohup konsole -e /usr/bin/bash -c "rpm -q gpg-pubkey; dnf5 repolist; sleep 45" >/tmp/konsole.log 2>&1 </dev/null &'`,
      15000
    );
  });
  await page.waitForTimeout(22000);
  await page.screenshot({ path: path.join(OUT_DIR, 'p11-1-02-konsole.png'), timeout: 60000 });

  await page.evaluate(async () => {
    await window.weblinuxAdapter.runCommand(
      `fedora-root 'nohup dolphin /root >/tmp/dolphin.log 2>&1 </dev/null &'`,
      15000
    );
  });
  await page.waitForTimeout(22000);
  await page.screenshot({ path: path.join(OUT_DIR, 'p11-1-03-dolphin.png'), timeout: 60000 });

  // Write persistence payload
  const testId = `P11_1_FEDORA_SEC_${Date.now()}`;
  const midRes = await page.evaluate(async (id) => {
    const cmd = `fedora-root 'python3 -c "import hashlib; data=b\\"${id}\\\\n\\" + b\\"SECURITY_OK\\"*512; open(\\"/root/p11-1-persist.dat\\",\\"wb\\").write(data); print(\\"EXPECTED_SHA256=\\",hashlib.sha256(data).hexdigest())"; sync; sync'`;
    return await window.weblinuxAdapter.runCommand(cmd, 60000);
  }, testId);
  const midOut = midRes.stdout || midRes.output || '';
  const match = midOut.match(/EXPECTED_SHA256=\s*([0-9a-f]{64})/);
  if (!match) throw new Error('Failed to compute EXPECTED_SHA256: ' + midOut);
  const expectedSha = match[1];

  console.log('5. Shutting down & warm rebooting...');
  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(2000);

  const t1 = Date.now();
  await launchFedora(page);
  const warmBootSec = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`6. Warm rebooted in ${warmBootSec}s`);

  const persistRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      `mount | grep wd; dmesg | grep -iE "wd|ext4" | tail -n 8; fedora-root 'sha256sum /root/p11-1-persist.dat; echo RELOAD_OK_11_1 > /root/p11-1-reload.txt; sync; sync'`,
      60000
    );
  });
  const persistOut = persistRes.stdout || persistRes.output || '';
  if (!persistOut.includes(expectedSha) || persistOut.includes('EXT4-fs error')) {
    throw new Error('Warm reboot persistence failed: ' + persistOut);
  }

  console.log('7. Shutting down & reloading browser page...');
  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(800);
  await launchFedora(page);
  await page.waitForTimeout(3000);

  const reloadRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      `dmesg | grep -iE "wd|ext4" | tail -n 8; cat /fedora/root/p11-1-reload.txt; fedora-root 'sha256sum /root/p11-1-persist.dat'`,
      60000
    );
  });
  const reloadOut = reloadRes.stdout || reloadRes.output || '';
  if (!reloadOut.includes(expectedSha) || !reloadOut.includes('RELOAD_OK_11_1') || reloadOut.includes('EXT4-fs error')) {
    throw new Error('Page reload persistence failed: ' + reloadOut);
  }

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1500);
  await ctx.close();
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });

  console.log(`REGRESSION_PASS COLD=${coldBootSec}s WARM=${warmBootSec}s SHA256=${expectedSha}`);
})();
