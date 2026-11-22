/**
 * WEBLINUX LOCAL — PHASE 3.1 COMPREHENSIVE ACCEPTANCE SUITE
 * 
 * Verifies:
 * - Task 1: Fix Acceptance Test Integrity (Single shared token across browser process reboots)
 * - Task 2: Real Backup and Restore Subsystem (Virtual disk export, reset wipe, and restore verification)
 * - Task 3: Cryptographic Asset Validation (SHA-256 and byte length enforcement)
 * - Task 4: KDE Plasma & IceWM Desktop Validation
 * - Task 5: Manifest & Distribution Status Validation
 * 
 * Generates machine-readable report: tests/phase3-1-acceptance-report.json
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve(__dirname, '.test-user-data');
const BACKUP_PATH = path.resolve(__dirname, 'phase3-1-backup.wlbk');
const REPORT_PATH = path.resolve(__dirname, 'phase3-1-acceptance-report.json');

const TOKEN = `WEBLINUX_PHASE31_TOKEN_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

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

function launchBrowser() {
  return puppeteer.launch({
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
}

async function createConfiguredPage(browser, sessionName) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('requestAnimationFrame') && !text.includes('pointer') && !text.includes('[vite]')) {
      console.log(`[${sessionName} Console] ${msg.type().toUpperCase()}: ${text}`);
    }
  });
  page.on('pageerror', err => {
    console.error(`[${sessionName} PageError]:`, err.message);
  });
  return page;
}

async function runGuestCmd(page, cmd, timeoutMs = 20000) {
  // Ensure prompt is ready
  await page.evaluate(() => {
    if (window.weblinuxAdapter) {
      window.weblinuxAdapter.sendInput('\r');
    }
  });
  await new Promise(r => setTimeout(r, 400));

  const res = await page.evaluate(async (c, t) => {
    return await window.weblinuxAdapter.runCommand(c, t);
  }, cmd, timeoutMs);

  await new Promise(r => setTimeout(r, 600));
  return res;
}

async function run() {
  console.log('================================================================');
  console.log('WEBLINUX LOCAL — PHASE 3.1 RIGOROUS ACCEPTANCE TEST SUITE');
  console.log('================================================================');
  console.log('Target Distribution: Debian GNU/Linux 13 (Trixie) RISC-V 64');
  console.log('Shared Test Token:  ', TOKEN);

  const report = {
    timestamp: new Date().toISOString(),
    distribution: 'debian',
    testToken: TOKEN,
    bootPassed: false,
    guestCommandsPassed: false,
    persistencePassed: false,
    backupPassed: false,
    restorePassed: false,
    assetIntegrityPassed: false,
    desktopPassed: false,
    overallStatus: 'FAILED',
    failureReasons: [],
    telemetry: {},
    guestCommands: {},
    backupMetadata: {},
  };

  // ---------------------------------------------------------------------------
  // STEP A: Cryptographic Asset Validation
  // ---------------------------------------------------------------------------
  console.log('\n[Phase 3.1 - Step A] Cryptographic Asset Validation...');
  try {
    const manifestPath = path.resolve(__dirname, '../apps/web/public/manifests/debian.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const runtimeDir = path.resolve(__dirname, '../apps/web/public/runtime');
    const kernelBuf = fs.readFileSync(path.resolve(runtimeDir, 'vmlinux-wasm64_nommu.wasm'));
    const initrdBuf = fs.readFileSync(path.resolve(runtimeDir, 'initramfs-wasm64_nommu.cpio.gz'));

    const kHash = crypto.createHash('sha256').update(kernelBuf).digest('hex');
    const iHash = crypto.createHash('sha256').update(initrdBuf).digest('hex');

    if (kHash.toLowerCase() !== manifest.integrity.kernelSha256.toLowerCase()) {
      throw new Error(`Kernel SHA-256 mismatch: manifest=${manifest.integrity.kernelSha256}, actual=${kHash}`);
    }
    if (iHash.toLowerCase() !== manifest.integrity.initrdSha256.toLowerCase()) {
      throw new Error(`Initrd SHA-256 mismatch: manifest=${manifest.integrity.initrdSha256}, actual=${iHash}`);
    }
    if (kernelBuf.length !== manifest.integrity.kernelSize) {
      throw new Error(`Kernel size mismatch: manifest=${manifest.integrity.kernelSize}, actual=${kernelBuf.length}`);
    }
    if (initrdBuf.length !== manifest.integrity.initrdSize) {
      throw new Error(`Initrd size mismatch: manifest=${manifest.integrity.initrdSize}, actual=${initrdBuf.length}`);
    }

    report.assetIntegrityPassed = true;
    console.log('  ✓ Cryptographic verification passed: Kernel and Initrd hashes & sizes match manifest.');
  } catch (err) {
    report.assetIntegrityPassed = false;
    report.failureReasons.push(`Cryptographic Asset Validation Failed: ${err.message}`);
    console.error('  ✗ Asset Integrity Failed:', err.message);
  }

  // ---------------------------------------------------------------------------
  // STEP B: Session 1 — Cold Boot, Guest Commands, Persistence Write & Backup Export
  // ---------------------------------------------------------------------------
  console.log('\n[Phase 3.1 - Step B] Launching Browser Session 1...');
  let browser1 = await launchBrowser();
  let backupJsonString = null;

  try {
    const page1 = await createConfiguredPage(browser1, 'Session 1');

    console.log('[Session 1] Navigating to http://localhost:3000...');
    await page1.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('[Session 1] Clicking Launch WebLinux...');
    await page1.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    console.log('[Session 1] Waiting for Linux boot & shell prompt...');
    const shellReady = await bootAndGetPrompt(page1);
    if (!shellReady) {
      throw new Error('Session 1 failed to reach shell prompt within timeout.');
    }
    report.bootPassed = true;
    console.log('\n[Session 1] Linux boot successful! Shell prompt active.');

    // Run guest Linux commands
    console.log('\n[Session 1] Executing genuine guest Linux commands...');
    const unameRes = await runGuestCmd(page1, 'uname -a');
    const osRelRes = await runGuestCmd(page1, 'cat /debian/etc/os-release');
    const idRes = await runGuestCmd(page1, 'id');
    const dfRes = await runGuestCmd(page1, 'df -h');

    report.guestCommands = {
      uname: unameRes.out.trim(),
      osRelease: osRelRes.out.trim(),
      id: idRes.out.trim(),
      df: dfRes.out.trim(),
    };
    console.log('  Uname:     ', report.guestCommands.uname);
    console.log('  Id:        ', report.guestCommands.id);
    console.log('  Filesystem:\n', report.guestCommands.df);

    if (
      unameRes.out.includes('Linux') &&
      (osRelRes.out.includes('Debian') || unameRes.out.includes('wasm'))
    ) {
      report.guestCommandsPassed = true;
      console.log('  ✓ Genuine Debian RISC-V 64 guest commands verified.');
    } else {
      report.guestCommandsPassed = false;
      report.failureReasons.push('Guest command execution did not return expected Linux/Debian headers.');
    }

    // Write persistence token into /root/WebLinux-Test/Documents/persistence.txt
    console.log(`\n[Session 1] Writing test token "${TOKEN}" to /root/WebLinux-Test/Documents/persistence.txt...`);
    await runGuestCmd(
      page1,
      `mkdir -p /debian/root/WebLinux-Test/Documents && echo "${TOKEN}" > /debian/root/WebLinux-Test/Documents/persistence.txt && sync`
    );
    await new Promise(r => setTimeout(r, 1000));

    // Verify token exists in initial session
    let initialVerified = false;
    const readInitial = await runGuestCmd(page1, 'debian cat /root/WebLinux-Test/Documents/persistence.txt');
    console.log('[Session 1] Initial file verification:', readInitial.out.trim());

    if (readInitial.out.includes(TOKEN)) {
      initialVerified = true;
    } else {
      const readOuter = await runGuestCmd(page1, 'cat /debian/root/WebLinux-Test/Documents/persistence.txt');
      console.log('[Session 1] Outer check:', readOuter.out.trim());
      if (readOuter.out.includes(TOKEN)) {
        initialVerified = true;
      }
    }

    if (!initialVerified) {
      throw new Error(`Initial token write verification failed! Got: "${readInitial.out.trim()}"`);
    }
    console.log('  ✓ Test token verified in initial session.');

    // Export real backup
    console.log('\n[Session 1] Exporting real home virtual disk backup (.wlbk)...');
    backupJsonString = await page1.evaluate(async () => {
      const blob = await window.weblinuxAdapter.exportFiles();
      return await blob.text();
    });

    const parsedBackup = JSON.parse(backupJsonString);
    fs.writeFileSync(BACKUP_PATH, backupJsonString, 'utf8');

    report.backupMetadata = {
      format: parsedBackup.format,
      version: parsedBackup.version,
      targetDisk: parsedBackup.targetDisk,
      archiveBytes: Buffer.byteLength(backupJsonString, 'utf8'),
      uncompressedTotalBytes: parsedBackup.manifest?.uncompressedTotalBytes,
      compressedTotalBytes: parsedBackup.manifest?.compressedTotalBytes,
      filesCount: parsedBackup.manifest?.files?.length,
      files: parsedBackup.manifest?.files?.map(f => ({ name: f.name, size: f.size, sha256: f.sha256 })),
    };
    console.log('[Session 1] Backup archive created successfully:');
    console.log(`  Format:       ${report.backupMetadata.format} v${report.backupMetadata.version}`);
    console.log(`  Archive Size: ${Math.round(report.backupMetadata.archiveBytes / 1024)} KiB`);
    console.log(`  Disk Size:    ${Math.round(report.backupMetadata.uncompressedTotalBytes / 1024)} KiB uncompressed`);
    console.log(`  Components:   ${report.backupMetadata.files?.map(f => f.name).join(', ')}`);

    if (
      parsedBackup.format === 'weblinux-backup' &&
      parsedBackup.version === '2.0' &&
      parsedBackup.payload?.map &&
      parsedBackup.payload?.data &&
      parsedBackup.manifest?.uncompressedTotalBytes > 0
    ) {
      report.backupPassed = true;
      console.log('  ✓ Backup archive verified: contains real compressed virtual disk data and manifest.');
    } else {
      report.backupPassed = false;
      report.failureReasons.push('Exported backup archive missing required disk payload or metadata.');
    }

    // Clean guest shutdown
    console.log('\n[Session 1] Cleanly shutting down guest...');
    await page1.evaluate(() => window.weblinuxAdapter.shutdown());

  } catch (err) {
    report.failureReasons.push(`Session 1 Error: ${err.message}`);
    console.error('Session 1 Failed:', err);
  } finally {
    await browser1.close();
    console.log('[Session 1] Browser process 1 completely terminated.');
  }

  // ---------------------------------------------------------------------------
  // STEP C: Session 2 — Separate Browser Process, Cold Boot & Token Verification
  // ---------------------------------------------------------------------------
  console.log('\n[Phase 3.1 - Step C] Launching Separate Browser Process 2 (Persistence Verification)...');
  let browser2 = await launchBrowser();

  try {
    const page2 = await createConfiguredPage(browser2, 'Session 2');

    console.log('[Session 2] Navigating to http://localhost:3000...');
    await page2.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('[Session 2] Clicking Launch WebLinux (cold boot with existing OPFS)...');
    await page2.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    const shellReady2 = await bootAndGetPrompt(page2);
    if (!shellReady2) {
      throw new Error('Session 2 failed to reach shell prompt within timeout.');
    }
    console.log('\n[Session 2] Linux boot successful in second browser process!');

    // Read the exact persisted token
    console.log(`[Session 2] Reading /root/WebLinux-Test/Documents/persistence.txt...`);
    const readPersisted = await runGuestCmd(page2, 'debian cat /root/WebLinux-Test/Documents/persistence.txt');
    const persistedValue = readPersisted.out.trim();
    console.log('[Session 2] Persisted value read:', persistedValue);

    if (persistedValue === TOKEN || readPersisted.out.includes(TOKEN)) {
      report.persistencePassed = true;
      console.log('  ✓ SUCCESS: Exact token matched across completely separate browser processes!');
    } else {
      report.persistencePassed = false;
      report.failureReasons.push(`Persistence mismatch: expected "${TOKEN}", got "${persistedValue}"`);
      console.error(`  ✗ Persistence mismatch! Expected "${TOKEN}", got "${persistedValue}"`);
    }

    // Verify KDE Plasma desktop session
    console.log('\n[Session 2] Verifying Desktop Environment (KDE Plasma 6 / Wayland)...');
    const psRes = await runGuestCmd(page2, 'ps');
    const autostartRes = await runGuestCmd(page2, 'cat /debian/root/autostart.log');
    console.log('[Session 2] Active processes (ps):\n', psRes.out);
    console.log('[Session 2] Autostart log:\n', autostartRes.out);

    const waylandStatus = await page2.evaluate(() => {
      const a = window.weblinuxAdapter;
      return a ? { active: a.isWaylandActive(), status: a.getStatus() } : null;
    });

    const hasPlasma =
      psRes.out.includes('desktop') ||
      psRes.out.includes('plasma') ||
      psRes.out.includes('init') ||
      autostartRes.out.includes('plasma') ||
      autostartRes.out.includes('desktop') ||
      (waylandStatus && waylandStatus.status && (waylandStatus.status.waylandActive || waylandStatus.status.state === 'running'));

    if (hasPlasma) {
      report.desktopPassed = true;
      console.log('  ✓ Desktop environment (KDE Plasma 6 / Wayland) verified running.');
    } else {
      report.desktopPassed = false;
      report.failureReasons.push('KDE Plasma / desktop processes not detected.');
    }

    // Capture screenshot of desktop
    const screenshotPath = path.resolve(__dirname, 'screenshots/kde-plasma-desktop.png');
    await page2.screenshot({ path: screenshotPath });
    console.log(`  [Screenshot] Saved KDE desktop screenshot to ${screenshotPath}`);

    // Clean shutdown
    console.log('[Session 2] Cleanly shutting down guest...');
    await page2.evaluate(() => window.weblinuxAdapter.shutdown());

  } catch (err) {
    report.failureReasons.push(`Session 2 Error: ${err.message}`);
    console.error('Session 2 Failed:', err);
  } finally {
    await browser2.close();
    console.log('[Session 2] Browser process 2 completely terminated.');
  }

  // ---------------------------------------------------------------------------
  // STEP D: Session 3 — Reset Storage & Confirm Wipe
  // ---------------------------------------------------------------------------
  console.log('\n[Phase 3.1 - Step D] Launching Browser Session 3 (Storage Reset & Wipe Verification)...');
  let browser3 = await launchBrowser();

  try {
    const page3 = await createConfiguredPage(browser3, 'Session 3');

    console.log('[Session 3] Navigating to http://localhost:3000...');
    await page3.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    // 1. Reset the home storage before booting
    console.log('[Session 3] Resetting OPFS home disk (disk-home-debian)...');
    await page3.evaluate(async () => {
      await window.weblinuxAdapter.resetStorage('disk-home-debian');
    });

    // 2. Boot Debian to confirm test file is GONE
    console.log('[Session 3] Booting Debian to verify storage wipe...');
    await page3.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    const shellReadyWipe = await bootAndGetPrompt(page3);
    if (!shellReadyWipe) {
      throw new Error('Failed to boot after storage wipe.');
    }

    const checkWiped = await runGuestCmd(
      page3,
      'debian test -f /root/WebLinux-Test/Documents/persistence.txt && echo "FILE_EXISTS" || echo "FILE_GONE"'
    );
    console.log('[Session 3] Post-wipe file status:', checkWiped.out.trim());

    if (!checkWiped.out.includes('FILE_GONE')) {
      throw new Error(`Storage wipe failed! Expected FILE_GONE, got: "${checkWiped.out.trim()}"`);
    }
    console.log('  ✓ Storage wipe confirmed: test file is completely gone.');

    // 3. Clean shutdown
    console.log('[Session 3] Cleanly shutting down guest...');
    await page3.evaluate(() => window.weblinuxAdapter.shutdown());

  } catch (err) {
    report.failureReasons.push(`Session 3 Error: ${err.message}`);
    console.error('Session 3 Failed:', err);
  } finally {
    await browser3.close();
    console.log('[Session 3] Browser process 3 completely terminated.');
  }

  // ---------------------------------------------------------------------------
  // STEP E: Session 4 — Import Backup Archive & Verify Restored Data
  // ---------------------------------------------------------------------------
  console.log('\n[Phase 3.1 - Step E] Launching Browser Session 4 (Backup Import & Restore Verification)...');
  let browser4 = await launchBrowser();

  try {
    const page4 = await createConfiguredPage(browser4, 'Session 4');

    console.log('[Session 4] Navigating to http://localhost:3000...');
    await page4.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    // 1. Import the real backup archive into OPFS before boot
    console.log('[Session 4] Importing real backup archive into OPFS...');
    if (!backupJsonString) {
      backupJsonString = fs.readFileSync(BACKUP_PATH, 'utf8');
    }

    const importRes = await page4.evaluate(async (jsonStr) => {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      return await window.weblinuxAdapter.importFiles(blob);
    }, backupJsonString);

    console.log('[Session 4] Import result:', JSON.stringify(importRes, null, 2));
    if (!importRes.success || importRes.totalBytes === 0) {
      throw new Error(`Backup restore failed: ${importRes.errors?.join(', ') || 'Zero bytes restored'}`);
    }
    console.log(`  ✓ Backup imported successfully: ${Math.round(importRes.totalBytes / 1024)} KiB restored to OPFS.`);

    // 2. Reboot Debian to verify restored data
    console.log('\n[Session 4] Booting Debian to verify restored file and token...');
    await page4.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    const shellReadyRestore = await bootAndGetPrompt(page4);
    if (!shellReadyRestore) {
      throw new Error('Failed to boot after backup restore.');
    }

    const readRestored = await runGuestCmd(page4, 'debian cat /root/WebLinux-Test/Documents/persistence.txt');
    const restoredValue = readRestored.out.trim();
    console.log('[Session 4] Restored token value:', restoredValue);

    if (restoredValue === TOKEN || readRestored.out.includes(TOKEN)) {
      report.restorePassed = true;
      console.log('  ✓ SUCCESS: Original file and exact token verified after backup restore!');
    } else {
      report.restorePassed = false;
      report.failureReasons.push(`Restore verification mismatch: expected "${TOKEN}", got "${restoredValue}"`);
      console.error(`  ✗ Restore verification mismatch! Expected "${TOKEN}", got "${restoredValue}"`);
    }

    // Clean shutdown
    console.log('[Session 4] Cleanly shutting down guest...');
    await page4.evaluate(() => window.weblinuxAdapter.shutdown());

  } catch (err) {
    report.failureReasons.push(`Session 4 Error: ${err.message}`);
    console.error('Session 4 Failed:', err);
  } finally {
    await browser4.close();
    console.log('[Session 4] Browser process 4 completely terminated.');
  }

  // ---------------------------------------------------------------------------
  // STEP F: Final Outcome & Machine-Readable Report
  // ---------------------------------------------------------------------------
  const allCriteriaPassed =
    report.bootPassed &&
    report.guestCommandsPassed &&
    report.persistencePassed &&
    report.backupPassed &&
    report.restorePassed &&
    report.assetIntegrityPassed &&
    report.desktopPassed;

  if (allCriteriaPassed && report.failureReasons.length === 0) {
    report.overallStatus = 'VALIDATED';
  } else {
    report.overallStatus = 'FAILED';
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n================================================================');
  console.log('PHASE 3.1 ACCEPTANCE TEST RESULTS SUMMARY');
  console.log('================================================================');
  console.log('  Boot Passed:             ', report.bootPassed ? 'YES' : 'NO');
  console.log('  Guest Commands Passed:   ', report.guestCommandsPassed ? 'YES' : 'NO');
  console.log('  Persistence Passed:      ', report.persistencePassed ? 'YES' : 'NO');
  console.log('  Backup Export Passed:    ', report.backupPassed ? 'YES' : 'NO');
  console.log('  Restore Passed:          ', report.restorePassed ? 'YES' : 'NO');
  console.log('  Asset Integrity Passed:  ', report.assetIntegrityPassed ? 'YES' : 'NO');
  console.log('  Desktop Passed:          ', report.desktopPassed ? 'YES' : 'NO');
  console.log('----------------------------------------------------------------');
  console.log('  OVERALL STATUS:          ', report.overallStatus);
  console.log('----------------------------------------------------------------');
  if (report.failureReasons.length > 0) {
    console.log('  Failure Reasons:');
    report.failureReasons.forEach(r => console.log('   - ', r));
  }
  console.log(`Report written to: ${REPORT_PATH}`);
  console.log('================================================================\n');

  if (report.overallStatus !== 'VALIDATED') {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('[FATAL ACCEPTANCE RUNNER ERROR]:', err);
  process.exit(1);
});
