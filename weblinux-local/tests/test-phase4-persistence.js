const { chromium } = require('playwright');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('================================================================');
  console.log('🧪 TEST: OPFS PERSISTENCE & GUEST REBOOT VERIFICATION');
  console.log('================================================================\n');

  const USER_DATA_DIR = path.resolve(__dirname, '.test-phase4-opfs-profile');
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  const TOKEN = 'PHASE4_PERSIST_TOKEN_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex');
  const EXPECTED_HASH = crypto.createHash('sha256').update(TOKEN + '\n').digest('hex');
  console.log(`Persistent Profile Dir: ${USER_DATA_DIR}`);
  console.log(`Generated Test Token: ${TOKEN}`);
  console.log(`Expected SHA-256 Hash: ${EXPECTED_HASH}\n`);

  // --- SESSION 1: CREATE FILE & SYNC ---
  console.log('[SESSION 1] Launching persistent browser context and booting Debian...');
  const context1 = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'msedge',
    headless: true,
    args: [
      '--enable-features=SharedArrayBuffer',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  const page1 = context1.pages()[0] || await context1.newPage();
  await page1.goto('http://localhost:3000');
  await page1.click('button:has-text("Launch WebLinux")');

  for (let i = 0; i < 40; i++) {
    await page1.waitForTimeout(1000);
    const ready = await page1.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await page1.waitForTimeout(3000);

  console.log('[SESSION 1] Writing test files to persistent home storage /root/WebLinux-Phase4-Test...');
  await page1.evaluate(async (tok) => {
    await window.weblinuxAdapter.runCommand('mkdir -p /debian/root/WebLinux-Phase4-Test/Documents /debian/root/WebLinux-Phase4-Test/Projects', 5000);
    await window.weblinuxAdapter.runCommand(`echo "${tok}" > /debian/root/WebLinux-Phase4-Test/persistence-check.txt`, 5000);
    await window.weblinuxAdapter.runCommand('echo "Project Notes Content" > /debian/root/WebLinux-Phase4-Test/Projects/project-notes.txt', 5000);
    await window.weblinuxAdapter.runCommand('echo "User Document Content" > /debian/root/WebLinux-Phase4-Test/Documents/user-document.txt', 5000);
    await window.weblinuxAdapter.runCommand('sync', 5000);
  }, TOKEN);

  // Verify file in session 1
  const s1Check = await page1.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/root/WebLinux-Phase4-Test/persistence-check.txt', 5000);
  });
  console.log('[SESSION 1] Written Content: ' + (s1Check.stdout || s1Check.out || '').trim());

  // Gracefully shut down guest and close browser
  console.log('[SESSION 1] Cleanly shutting down guest and closing browser...');
  await page1.evaluate(async () => {
    await window.weblinuxAdapter.runCommand('sync', 3000);
    if (window.weblinuxAdapter.shutdown) {
      await window.weblinuxAdapter.shutdown();
    }
  });
  await page1.waitForTimeout(2000);
  await context1.close();
  console.log('  ✓ Browser 1 closed completely.\n');

  // Wait 3 seconds before session 2 to ensure OS flushes locks
  await new Promise(r => setTimeout(r, 3000));

  // --- SESSION 2: RELOAD & VERIFY PERSISTENCE ---
  console.log('[SESSION 2] Launching second browser process with the exact same OPFS persistent profile...');
  const context2 = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'msedge',
    headless: true,
    args: [
      '--enable-features=SharedArrayBuffer',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  const page2 = context2.pages()[0] || await context2.newPage();
  await page2.goto('http://localhost:3000');
  await page2.click('button:has-text("Launch WebLinux")');

  for (let i = 0; i < 40; i++) {
    await page2.waitForTimeout(1000);
    const ready = await page2.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await page2.waitForTimeout(3000);

  console.log('[SESSION 2] Reading persisted file from /root/WebLinux-Phase4-Test/persistence-check.txt...');
  const s2Check = await page2.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/root/WebLinux-Phase4-Test/persistence-check.txt', 5000);
  });
  const persistedContent = (s2Check.stdout || s2Check.out || '').trim();
  console.log(`[SESSION 2] Read Content: "${persistedContent}"`);

  const s2Tree = await page2.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ls -la /debian/root/WebLinux-Phase4-Test && ls -la /debian/root/WebLinux-Phase4-Test/Projects && ls -la /debian/root/WebLinux-Phase4-Test/Documents', 5000);
  });
  console.log('[SESSION 2] Persisted Directory Tree:\n' + (s2Tree.stdout || s2Tree.out || '').trim());

  const tokenMatches = persistedContent === TOKEN;
  const hashMatches = crypto.createHash('sha256').update(persistedContent + '\n').digest('hex') === EXPECTED_HASH;

  console.log('\n--- PERSISTENCE VERIFICATION RESULT ---');
  console.log(`Token Match: ${tokenMatches ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`SHA-256 Digest Match: ${hashMatches ? 'PASS ✓' : 'FAIL ✗'}`);

  await context2.close();

  if (tokenMatches && hashMatches) {
    console.log('\n>>> PERSISTENCE ACCEPTANCE: PASSED 100% <<<');
  } else {
    console.error('\n>>> PERSISTENCE ACCEPTANCE: FAILED <<<');
    process.exit(1);
  }
})().catch(err => {
  console.error('Fatal persistence test error:', err);
  process.exit(1);
});
