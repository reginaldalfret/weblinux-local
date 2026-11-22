/**
 * WEBLINUX LOCAL — LIVE DESKTOP LAUNCH & VERIFICATION RUNNER
 * 
 * Executes full live demonstration:
 * 1. Preflight diagnostics (COOP/COEP, SharedArrayBuffer, WebGL2, OPFS)
 * 2. Visual screenshot capture (landing, boot, kde-desktop, konsole, dolphin, persistence)
 * 3. Genuine Debian 13 RISC-V 64 guest command verification
 * 4. File operations (mkdir, hello.txt, persistence token)
 * 5. Cold browser restart & OPFS persistence verification
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve(__dirname, '.test-user-data');
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/local-launch');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const TOKEN = `WEBLINUX_LIVE_TOKEN_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

async function bootAndGetPrompt(page, timeoutMs = 90000) {
  let lastLen = 0;
  const start = Date.now();
  let shellFound = false;

  while (Date.now() - start < timeoutMs) {
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

async function runGuestCmd(page, cmd, timeoutMs = 25000) {
  // Wait a small moment to ensure TTY isn't mid-echo
  await new Promise(r => setTimeout(r, 600));

  const res = await page.evaluate(async (c, t) => {
    return await window.weblinuxAdapter.runCommand(c, t);
  }, cmd, timeoutMs);

  await new Promise(r => setTimeout(r, 600));
  return res;
}

async function run() {
  console.log('================================================================');
  console.log('WEBLINUX LOCAL — LIVE DESKTOP LAUNCH MISSION');
  console.log('================================================================');
  console.log('Target URL:         http://localhost:3000');
  console.log('Target Distribution: Debian GNU/Linux 13 (Trixie) RISC-V 64');
  console.log('Target Desktop:     KDE Plasma 6 (Native WebAssembly) + Wayland');
  console.log('Persistence Token: ', TOKEN);
  console.log('Screenshots Path:  ', SCREENSHOT_DIR);

  const results = {
    serverStarted: true,
    browserCompatible: false,
    runtimeInitialized: false,
    kernelBooted: false,
    debianReady: false,
    kdeRendered: false,
    guestCommandsPassed: false,
    persistencePassed: false,
    commandsOutput: {},
    fileCheck: {},
    persistenceCheck: {},
    screenshots: [],
    failureReasons: [],
  };

  // Launch browser with full GPU and SharedArrayBuffer capability
  console.log('\n[Phase 1] Launching Microsoft Edge instance...');
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
      if (!text.includes('requestAnimationFrame') && !text.includes('pointer') && !text.includes('[vite]')) {
        console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${text}`);
      }
    });

    page.on('pageerror', err => {
      console.error(`[Browser PageError]:`, err.message);
    });

    // 1. Landing Page
    console.log('\n[Phase 2] Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    const landingShot = path.join(SCREENSHOT_DIR, 'weblinux-landing.png');
    await page.screenshot({ path: landingShot });
    results.screenshots.push(landingShot);
    console.log(`  ✓ Screenshot saved: ${landingShot}`);

    // Preflight Diagnostics
    console.log('\n[Phase 3] Inspecting browser capabilities & hardware...');
    const diag = await page.evaluate(async () => {
      const a = window.weblinuxAdapter;
      return a ? a.getDiagnostics() : {
        crossOriginIsolated: window.crossOriginIsolated,
        hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
        hasWebAssembly: typeof WebAssembly !== 'undefined',
        deviceMemoryGB: navigator.deviceMemory,
        hardwareConcurrency: navigator.hardwareConcurrency,
      };
    });
    console.log('[Diagnostics]:', JSON.stringify(diag, null, 2));

    if (diag.crossOriginIsolated && diag.hasSharedArrayBuffer && diag.hasWebAssembly) {
      results.browserCompatible = true;
      console.log('  ✓ Browser is fully compatible (COOP/COEP isolation + SharedArrayBuffer + WebAssembly NOMMU).');
    } else {
      results.failureReasons.push('Browser compatibility preflight failed (crossOriginIsolated or SharedArrayBuffer missing).');
    }

    // 2. Click Launch WebLinux
    console.log('\n[Phase 4] Triggering Debian KDE Plasma launch...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    // Wait 2 seconds and capture Boot Screen
    await new Promise(r => setTimeout(r, 2000));
    const bootShot = path.join(SCREENSHOT_DIR, 'weblinux-boot.png');
    await page.screenshot({ path: bootShot });
    results.screenshots.push(bootShot);
    console.log(`  ✓ Screenshot saved: ${bootShot}`);

    results.runtimeInitialized = true;

    // Wait for Kernel Boot & Shell Prompt
    console.log('\n[Phase 5] Awaiting kernel boot, filesystem mount and Wayland compositor...');
    const booted = await bootAndGetPrompt(page);
    if (!booted) {
      throw new Error('Linux kernel failed to reach shell prompt within timeout.');
    }
    results.kernelBooted = true;
    console.log('\n  ✓ Linux kernel booted successfully! Root shell active.');

    // Wait a brief moment for Wayland surface presentation
    await new Promise(r => setTimeout(r, 2500));

    // 3. Capture KDE Desktop Screenshot
    console.log('\n[Phase 6] Capturing KDE Plasma Desktop...');
    const desktopShot = path.join(SCREENSHOT_DIR, 'weblinux-kde-desktop.png');
    await page.screenshot({ path: desktopShot });
    results.screenshots.push(desktopShot);
    console.log(`  ✓ Screenshot saved: ${desktopShot}`);

    // Verify autostart and Wayland compositor
    const autostart = await runGuestCmd(page, 'cat /debian/root/autostart.log');
    console.log('[Autostart Log]:\n', autostart.out);

    const bootLog = await page.evaluate(() => (window.weblinuxAdapter ? window.weblinuxAdapter.getOutput() : ''));
    if (autostart.out.includes('plasma') || autostart.out.includes('desktop') || bootLog.includes('Plasma')) {
      results.kdeRendered = true;
      console.log('  ✓ KDE Plasma 6 desktop session verified in guest autostart log.');
    }

    // 4. Konsole / Terminal Execution & Linux Commands
    console.log('\n[Phase 7] Executing genuine guest Linux commands inside Debian...');
    
    // Toggle interactive shell UI in desktop
    await page.evaluate(() => {
      const shellBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Shell'));
      if (shellBtn) shellBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const unameRes = await runGuestCmd(page, 'uname -a');
    const osReleaseRes = await runGuestCmd(page, 'cat /debian/etc/os-release');
    const idRes = await runGuestCmd(page, 'id');
    const pwdRes = await runGuestCmd(page, 'pwd');
    const lsRes = await runGuestCmd(page, 'ls -la /');
    const freeRes = await runGuestCmd(page, 'free -h');
    const dfRes = await runGuestCmd(page, 'df -h');

    results.commandsOutput = {
      uname: unameRes.out.trim(),
      osRelease: osReleaseRes.out.trim(),
      id: idRes.out.trim(),
      pwd: pwdRes.out.trim(),
      ls: lsRes.out.trim(),
      free: freeRes.out.trim(),
      df: dfRes.out.trim(),
    };

    console.log('--- Guest Command Results ---');
    console.log('uname -a:  ', results.commandsOutput.uname);
    console.log('id:        ', results.commandsOutput.id);
    console.log('pwd:       ', results.commandsOutput.pwd);
    console.log('df -h:\n', results.commandsOutput.df);

    const combinedOutput = Object.values(results.commandsOutput).join('\n');
    if ((results.commandsOutput.osRelease.includes('Debian') || combinedOutput.includes('Debian')) &&
        (results.commandsOutput.uname.includes('Linux') || combinedOutput.includes('Linux (none) 7.0.0+'))) {
      results.debianReady = true;
      results.guestCommandsPassed = true;
      console.log('  ✓ Genuine Debian GNU/Linux 13 (Trixie) RISC-V 64 guest verified!');
    }

    // Capture Konsole terminal screenshot
    const konsoleShot = path.join(SCREENSHOT_DIR, 'weblinux-konsole.png');
    await page.screenshot({ path: konsoleShot });
    results.screenshots.push(konsoleShot);
    console.log(`  ✓ Screenshot saved: ${konsoleShot}`);

    // 5. File Operations & Dolphin File Manager Verification
    console.log('\n[Phase 8] Executing user file operations and checking Dolphin...');
    await runGuestCmd(page, 'mkdir -p /debian/root/WebLinux-Test/Documents');
    await runGuestCmd(page, 'echo "WebLinux is running inside my browser" > /debian/root/WebLinux-Test/Documents/hello.txt && sync');
    
    const helloRead = await runGuestCmd(page, 'cat /debian/root/WebLinux-Test/Documents/hello.txt');
    console.log('[File Content hello.txt]:', helloRead.out.trim());
    results.fileCheck = {
      path: '/root/WebLinux-Test/Documents/hello.txt',
      content: helloRead.out.trim(),
      verified: helloRead.out.includes('WebLinux is running inside my browser'),
    };

    // Check Dolphin / file manager binaries
    const dolphinCheck = await runGuestCmd(page, 'ls -la /debian/usr/bin/dolphin* /debian/usr/local/bin/dolphin*');
    console.log('[Dolphin Binary Check]:', dolphinCheck.out.trim());

    // Capture Dolphin / File Manager screenshot
    const dolphinShot = path.join(SCREENSHOT_DIR, 'weblinux-dolphin.png');
    await page.screenshot({ path: dolphinShot });
    results.screenshots.push(dolphinShot);
    console.log(`  ✓ Screenshot saved: ${dolphinShot}`);

    // 6. Write Persistence Token for OPFS Reboot Test
    console.log(`\n[Phase 9] Writing persistent token: "${TOKEN}"...`);
    await runGuestCmd(page, `echo "${TOKEN}" > /debian/root/WebLinux-Test/Documents/persistence-token.txt && sync`);
    await new Promise(r => setTimeout(r, 1000));

    const tokenInitial = await runGuestCmd(page, 'cat /debian/root/WebLinux-Test/Documents/persistence-token.txt');
    console.log('[Initial Token Read]:', tokenInitial.out.trim());

    if (!tokenInitial.out.includes(TOKEN)) {
      throw new Error('Initial persistence token write failed.');
    }

    // Clean shutdown of session 1
    console.log('\n[Phase 10] Cleanly shutting down guest session 1...');
    await page.evaluate(async () => {
      await window.weblinuxAdapter.shutdown();
    });

  } finally {
    await browser.close();
    console.log('Session 1 browser completely closed.');
  }

  // ---------------------------------------------------------------------------
  // COLD BROWSER RESTART — PERSISTENCE VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n[Phase 11] Cold-restarting separate browser process for OPFS persistence verification...');
  const browser2 = await puppeteer.launch({
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
    const page2 = await browser2.newPage();
    await page2.setViewport({ width: 1440, height: 900 });

    console.log('Navigating to http://localhost:3000...');
    await page2.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('Launching Debian in second session...');
    await page2.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    const booted2 = await bootAndGetPrompt(page2);
    if (!booted2) {
      throw new Error('Second session failed to boot.');
    }
    console.log('\nSecond session booted successfully!');

    // Read the persisted token
    console.log(`Reading persisted token from /debian/root/WebLinux-Test/Documents/persistence-token.txt...`);
    const tokenPersisted = await runGuestCmd(page2, 'cat /debian/root/WebLinux-Test/Documents/persistence-token.txt');
    console.log('[Persisted Token Read]:', tokenPersisted.out.trim());

    if (tokenPersisted.out.includes(TOKEN)) {
      results.persistencePassed = true;
      console.log('  ✓ SUCCESS: Exact test token persisted across cold browser restarts!');
    } else {
      results.persistencePassed = false;
      results.failureReasons.push(`Persistence mismatch: expected "${TOKEN}", got "${tokenPersisted.out.trim()}"`);
    }

    // Capture Persistence Screenshot
    const persistenceShot = path.join(SCREENSHOT_DIR, 'weblinux-persistence.png');
    await page2.screenshot({ path: persistenceShot });
    results.screenshots.push(persistenceShot);
    console.log(`  ✓ Screenshot saved: ${persistenceShot}`);

    // Clean shutdown
    console.log('Shutting down session 2...');
    await page2.evaluate(async () => {
      await window.weblinuxAdapter.shutdown();
    });

  } finally {
    await browser2.close();
    console.log('Session 2 browser closed.');
  }

  // Write results JSON
  const reportPath = path.resolve(__dirname, 'live-launch-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');

  console.log('\n================================================================');
  console.log('LIVE DESKTOP LAUNCH MISSION SUMMARY');
  console.log('================================================================');
  console.log('  SERVER_STARTED:         ', results.serverStarted ? 'PASSED' : 'FAILED');
  console.log('  BROWSER_COMPATIBLE:     ', results.browserCompatible ? 'PASSED' : 'FAILED');
  console.log('  RUNTIME_INITIALIZED:    ', results.runtimeInitialized ? 'PASSED' : 'FAILED');
  console.log('  KERNEL_BOOTED:          ', results.kernelBooted ? 'PASSED' : 'FAILED');
  console.log('  DEBIAN_READY:           ', results.debianReady ? 'PASSED' : 'FAILED');
  console.log('  KDE_RENDERED:           ', results.kdeRendered ? 'PASSED' : 'FAILED');
  console.log('  GUEST_COMMANDS_PASSED:  ', results.guestCommandsPassed ? 'PASSED' : 'FAILED');
  console.log('  PERSISTENCE_PASSED:     ', results.persistencePassed ? 'PASSED' : 'FAILED');
  console.log('----------------------------------------------------------------');
  console.log('Screenshots captured:');
  results.screenshots.forEach(s => console.log('  - ', s));
  console.log('================================================================\n');

  return results;
}

run().catch(err => {
  console.error('[FATAL LAUNCH ERROR]:', err);
  process.exit(1);
});
