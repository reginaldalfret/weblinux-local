const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve(__dirname, '.test-user-data');

async function run() {
  console.log('[Test Runner] Launching headless browser with isolated OPFS profile...');
  const browser = await puppeteer.launch({
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
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('requestAnimationFrame') && !text.includes('pointer')) {
        console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${text}`);
      }
    });

    page.on('pageerror', err => {
      console.error(`[Browser PageError]:`, err.message);
    });

    console.log('[Test Runner] Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    // Verify diagnostics
    const diag = await page.evaluate(async () => {
      const adapter = window.weblinuxAdapter;
      return adapter ? adapter.getDiagnostics() : null;
    });
    console.log('[Diagnostics Result]:', JSON.stringify(diag, null, 2));

    // Click launch button
    console.log('[Test Runner] Triggering Debian boot...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    // Monitor boot output for up to 180 seconds
    console.log('[Test Runner] Waiting for kernel boot and root shell prompt...');
    let lastLen = 0;
    const start = Date.now();
    let shellFound = false;

    while (Date.now() - start < 180000) {
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
        const fresh = res.out.slice(lastLen);
        process.stdout.write(fresh);
        lastLen = res.out.length;
      }

      // If kernel has started user init or mounted filesystems, send Enter to prompt the shell
      if (res.out.includes('EXT4-fs (wdb)') || res.out.includes('autostart:') || res.out.includes('Run /init')) {
        await page.evaluate(() => {
          if (window.weblinuxAdapter) {
            window.weblinuxAdapter.sendInput('\r');
          }
        });
      }

      if (res.out.includes('# ') || (res.status && res.status.shellReady)) {
        console.log('\n[Test Runner] Linux shell prompt detected (# )!');
        shellFound = true;
        break;
      }
    }

    if (!shellFound) {
      throw new Error(`Shell prompt not reached within timeout. Output length: ${lastLen}`);
    }

    // Save boot screenshot
    await page.screenshot({ path: path.resolve(__dirname, 'screenshots/debian-boot.png') });
    console.log('[Test Runner] Screenshot saved to tests/screenshots/debian-boot.png');

    // Run required Linux commands directly inside guest
    const commands = [
      'uname -a',
      'cat /etc/os-release',
      'id',
      'pwd',
      'ls -la /',
      'df -h',
      'free -h'
    ];

    const results = {};

    for (const cmd of commands) {
      console.log(`\n[Test Runner] Executing guest command: ${cmd}`);
      const res = await page.evaluate(async (commandToRun) => {
        return await window.weblinuxAdapter.runCommand(commandToRun, 30000);
      }, cmd);
      results[cmd] = res;
      console.log(`[Result: ${cmd}] (rc=${res.rc}, time=${res.ms}ms):\n${res.out}`);
    }

    // Save terminal commands screenshot
    await page.screenshot({ path: path.resolve(__dirname, 'screenshots/terminal-commands.png') });
    console.log('\n[Test Runner] Screenshot saved to tests/screenshots/terminal-commands.png');

    // OPFS Persistence Test: write test token to /root/weblinux-test.txt
    const testToken = `WEBLINUX_PERSISTENCE_TEST_${Date.now()}_AUTHENTIC`;
    console.log(`\n[Test Runner] Writing persistence test token: ${testToken}`);
    const writeRes = await page.evaluate(async (token) => {
      return await window.weblinuxAdapter.runCommand(`echo "${token}" > /root/weblinux-test.txt; sync`, 15000);
    }, testToken);
    console.log('[Write Result]:', writeRes);

    const verifyRes = await page.evaluate(async () => {
      return await window.weblinuxAdapter.runCommand('cat /root/weblinux-test.txt', 15000);
    });
    console.log(`[Verify Result (first boot)]:\n${verifyRes.out}`);

    if (!verifyRes.out.includes(testToken)) {
      throw new Error(`Written test token not found in guest filesystem! Got: ${verifyRes.out}`);
    }

    console.log('\n[Test Runner] Shutting down guest cleanly (sync; poweroff)...');
    await page.evaluate(async () => {
      await window.weblinuxAdapter.shutdown();
    });

    console.log('[Test Runner] First session completed and persisted.');

    // Save results JSON
    fs.writeFileSync(
      path.resolve(__dirname, 'acceptance-test-results.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), diagnostics: diag, commandResults: results, testToken }, null, 2)
    );

  } finally {
    await browser.close();
    console.log('[Test Runner] Browser session closed.');
  }
}

run().catch(err => {
  console.error('[Test Failed]:', err);
  process.exit(1);
});
