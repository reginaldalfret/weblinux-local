/**
 * WebLinux Phase 4.1.1 - OPFS Persistence & Profile Isolation Spec
 * Validates:
 * 1. Cold reboot persistence within the same persistent profile (exact token & SHA-256 match).
 * 2. Strict profile isolation (separate profile does NOT inherit data).
 */

const { chromium } = require('playwright');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { assertExact, assertSha256 } = require('../helpers/assertions');

async function runOpfsTests(recorder, baseProfileDir, screenshotDir) {
  console.log('\n--- EXECUTING OPFS PERSISTENCE & PROFILE ISOLATION TESTS ---');

  const PROFILE_A = path.join(baseProfileDir, 'profile-a');
  const PROFILE_B = path.join(baseProfileDir, 'profile-b');
  fs.mkdirSync(PROFILE_A, { recursive: true });
  fs.mkdirSync(PROFILE_B, { recursive: true });

  const TOKEN = `PHASE4_1_1_COLD_TOKEN_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const EXPECTED_HASH = crypto.createHash('sha256').update(TOKEN + '\n').digest('hex');

  // =========================================================================
  // TEST A: Cold Reboot Persistence (Same Persistent Profile)
  // =========================================================================
  console.log('[OPFS Test A] Session 1: Writing token to Profile A...');
  const t0 = performance.now();

  const contextA1 = await chromium.launchPersistentContext(PROFILE_A, {
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=SharedArrayBuffer', '--no-sandbox', '--disable-setuid-sandbox']
  });
  const pageA1 = contextA1.pages()[0] || await contextA1.newPage();
  await pageA1.setViewportSize({ width: 1600, height: 900 });
  await pageA1.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await pageA1.click('button:has-text("Launch WebLinux")');

  for (let i = 0; i < 40; i++) {
    await pageA1.waitForTimeout(1000);
    const ready = await pageA1.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await pageA1.waitForTimeout(4000);

  // Write file to persistent home partition (/root on /dev/wdb ext4 inside Debian)
  await pageA1.evaluate(async (tok) => {
    await window.weblinuxAdapter.runCommand(
      `chroot /debian /bin/sh -c "mkdir -p /root/OPFS-Verification && echo '${tok}' > /root/OPFS-Verification/token.txt && sync"`,
      8000
    );
  }, TOKEN);

  const shotPath16 = path.join(screenshotDir, '16-opfs-session-one.png');
  await pageA1.screenshot({ path: shotPath16 });

  // Clean shutdown of Session 1
  await pageA1.evaluate(async () => {
    await window.weblinuxAdapter.runCommand('sync', 3000);
    if (window.weblinuxAdapter.shutdown) await window.weblinuxAdapter.shutdown();
  });
  await pageA1.waitForTimeout(1500);
  await contextA1.close();
  console.log('  ✓ Session 1 context closed and profile released.');

  // Wait 3 seconds for lock release
  await new Promise(r => setTimeout(r, 3000));

  // Launch Session 2 with the EXACT same Profile A
  console.log('[OPFS Test A] Session 2: Launching fresh browser with Profile A...');
  const contextA2 = await chromium.launchPersistentContext(PROFILE_A, {
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=SharedArrayBuffer', '--no-sandbox', '--disable-setuid-sandbox']
  });
  const pageA2 = contextA2.pages()[0] || await contextA2.newPage();
  await pageA2.setViewportSize({ width: 1600, height: 900 });
  await pageA2.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await pageA2.click('button:has-text("Launch WebLinux")');

  for (let i = 0; i < 40; i++) {
    await pageA2.waitForTimeout(1000);
    const ready = await pageA2.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await pageA2.waitForTimeout(4000);

  const readBack = await pageA2.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      'chroot /debian /bin/sh -c "cat /root/OPFS-Verification/token.txt 2>/dev/null"',
      8000
    );
  });
  const actualToken = (readBack.stdout || readBack.out || '').trim();

  const shotPath17 = path.join(screenshotDir, '17-opfs-session-two.png');
  await pageA2.screenshot({ path: shotPath17 });

  await contextA2.close();
  const elapsedA = Math.round(performance.now() - t0);

  const tokenMatches = actualToken === TOKEN;
  const hashRes = assertSha256(actualToken + '\n', EXPECTED_HASH, 'OPFS Cold Reboot');

  recorder.record(
    'OPFS-01',
    'OPFS Cold Reboot Data Persistence (Exact Token Match)',
    'storage',
    tokenMatches,
    tokenMatches ? `Token persisted perfectly across cold restart: "${actualToken}"` : `Token mismatch. Expected "${TOKEN}", read "${actualToken}"`,
    [shotPath16, shotPath17],
    elapsedA
  );

  recorder.record(
    'OPFS-02',
    'OPFS Cryptographic SHA-256 Digest Match',
    'storage',
    hashRes.passed,
    hashRes.details,
    [shotPath17],
    elapsedA
  );

  // =========================================================================
  // TEST B: Profile Storage Isolation
  // =========================================================================
  console.log('[OPFS Test B] Launching separate clean Profile B...');
  const t1 = performance.now();

  const contextB = await chromium.launchPersistentContext(PROFILE_B, {
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=SharedArrayBuffer', '--no-sandbox', '--disable-setuid-sandbox']
  });
  const pageB = contextB.pages()[0] || await contextB.newPage();
  await pageB.setViewportSize({ width: 1600, height: 900 });
  await pageB.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await pageB.click('button:has-text("Launch WebLinux")');

  for (let i = 0; i < 40; i++) {
    await pageB.waitForTimeout(1000);
    const ready = await pageB.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await pageB.waitForTimeout(4000);

  const profileBCheck = await pageB.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      'chroot /debian /bin/sh -c "cat /root/OPFS-Verification/token.txt 2>/dev/null"',
      8000
    );
  });
  const profileBOutput = (profileBCheck.stdout || profileBCheck.out || '').trim();
  await contextB.close();
  const elapsedB = Math.round(performance.now() - t1);

  // File must NOT exist in isolated Profile B
  const isolated = !profileBOutput.includes(TOKEN);
  recorder.record(
    'OPFS-03',
    'Browser Profile Storage Isolation',
    'storage',
    isolated,
    isolated
      ? `Verified isolation: Fresh Profile B did not inherit Profile A data ("${profileBOutput}")`
      : 'Isolation failure! Profile B unexpectedly contains Profile A data',
    [],
    elapsedB
  );
}

module.exports = { runOpfsTests };
