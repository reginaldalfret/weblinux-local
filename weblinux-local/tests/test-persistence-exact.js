const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve(__dirname, '.test-user-data');
const TOKEN = `WEBLINUX_OPFS_EXT4_VERIFIED_${Date.now()}`;

async function bootAndGetPrompt(page) {
  let lastLen = 0;
  const start = Date.now();
  let shellFound = false;

  while (Date.now() - start < 90000) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await page.evaluate(() => {
      const adapter = window.weblinuxAdapter;
      if (!adapter) return { out: '', status: null };
      return {
        out: adapter.getOutput ? adapter.getOutput() : '',
        status: adapter.getStatus ? adapter.getStatus() : null,
      };
    });

    if (res.out.length > lastLen) {
      process.stdout.write(res.out.slice(lastLen));
      lastLen = res.out.length;
    }

    if (res.out.includes('autostart:') || res.out.includes('EXT4-fs (wdb)')) {
      await page.evaluate(() => {
        if (window.weblinuxAdapter) {
          window.weblinuxAdapter.sendInput('\r');
        }
      });
    }

    if (res.out.includes('# ') || (res.status && res.status.shellReady)) {
      shellFound = true;
      break;
    }
  }
  return shellFound;
}

async function run() {
  console.log('================================================================');
  console.log('ACCEPTANCE TEST: RIGOROUS OPFS REBOOT PERSISTENCE');
  console.log('================================================================');
  console.log('Target Token:', TOKEN);

  // -------------------------------------------------------------------------
  // SESSION 1: Write file to Debian root home partition (/dev/wdb)
  // -------------------------------------------------------------------------
  console.log('\n--- SESSION 1: WRITE TO OPFS EXT4 DISK ---');
  let browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    userDataDir: USER_DATA_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-features=SharedArrayBuffer',
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=default',
      '--window-size=1440,900',
    ],
  });

  try {
    let page = await browser.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    console.log('[Session 1] Booting Debian...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    const ready = await bootAndGetPrompt(page);
    if (!ready) throw new Error('Session 1 failed to reach shell prompt');
    console.log('\n[Session 1] Shell prompt active.');

    // Write file directly into /debian/root/weblinux-test.txt (which is /dev/wdb ext4 persistent disk)
    console.log(`[Session 1] Writing "${TOKEN}" to /debian/root/weblinux-test.txt...`);
    const writeRes = await page.evaluate(async (tok) => {
      return await window.weblinuxAdapter.runCommand(`echo "${tok}" > /debian/root/weblinux-test.txt; sync`, 15000);
    }, TOKEN);
    console.log('[Session 1] Write result:', writeRes);

    // Verify inside Debian chroot
    const verify1 = await page.evaluate(async () => {
      return await window.weblinuxAdapter.runCommand('debian cat /root/weblinux-test.txt', 15000);
    });
    console.log('[Session 1] debian cat /root/weblinux-test.txt:\n', verify1.out);

    if (!verify1.out.includes(TOKEN)) {
      throw new Error('Initial write verification failed!');
    }

    // Clean shutdown
    console.log('[Session 1] Cleanly shutting down guest...');
    await page.evaluate(async () => {
      await window.weblinuxAdapter.shutdown();
    });
  } finally {
    await browser.close();
    console.log('[Session 1] Browser closed.');
  }

  // -------------------------------------------------------------------------
  // SESSION 2: Launch completely fresh browser and verify file persisted on OPFS
  // -------------------------------------------------------------------------
  console.log('\n--- SESSION 2: VERIFY PERSISTENCE AFTER BROWSER RESTART ---');
  browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    userDataDir: USER_DATA_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-features=SharedArrayBuffer',
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=default',
      '--window-size=1440,900',
    ],
  });

  try {
    let page = await browser.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    console.log('[Session 2] Booting Debian...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    const ready = await bootAndGetPrompt(page);
    if (!ready) throw new Error('Session 2 failed to reach shell prompt');
    console.log('\n[Session 2] Shell prompt active.');

    // Verify file persisted across browser reboot
    console.log(`[Session 2] Checking /debian/root/weblinux-test.txt...`);
    const verify2 = await page.evaluate(async () => {
      return await window.weblinuxAdapter.runCommand('debian cat /root/weblinux-test.txt', 15000);
    });
    console.log('[Session 2] debian cat /root/weblinux-test.txt:\n', verify2.out);

    if (!verify2.out.includes(TOKEN)) {
      throw new Error(`CRITICAL: Persistence failed! Expected "${TOKEN}", got "${verify2.out}"`);
    }

    console.log('\n================================================================');
    console.log('>>> ACCEPTANCE PASSED: OPFS PERSISTENCE CONFIRMED ACROSS REBOOTS! <<<');
    console.log('================================================================');

    // Test IceWM capability
    console.log('\n[IceWM Evaluation] Checking desktop launcher script options...');
    const desktopHelp = await page.evaluate(async () => {
      return await window.weblinuxAdapter.runCommand('head -n 25 /debian/usr/local/bin/desktop', 15000);
    });
    console.log('[Desktop script header]:\n', desktopHelp.out);

    // Take screenshot of persisted state
    await page.screenshot({ path: path.resolve(__dirname, 'screenshots/opfs-persistence.png') });
    console.log('[Screenshot] Saved to tests/screenshots/opfs-persistence.png');

    await page.evaluate(async () => {
      await window.weblinuxAdapter.shutdown();
    });

  } finally {
    await browser.close();
    console.log('[Session 2] Browser closed.');
  }
}

run().catch(err => {
  console.error('[Persistence Test Error]:', err);
  process.exit(1);
});
