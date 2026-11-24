/**
 * WEBLINUX LOCAL — PHASE 6.3: DEBIAN <-> UBUNTU TWO-WAY SWITCHING & PERSISTENCE TEST
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, '../../screenshots/phase6');
const ARTIFACT_DIR = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1';

async function run() {
  console.log('================================================================');
  console.log('🔄 WEBLINUX LOCAL — DEBIAN <-> UBUNTU SWITCHING & OPFS ISOLATION');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-features=SharedArrayBuffer',
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=default',
      '--window-size=1600,950',
    ],
  });

  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // --- STAGE 1: BOOT UBUNTU & CHECK INITIAL PERSISTENCE ---
  console.log('[STAGE 1] Booting Ubuntu 24.04.5 LTS...');
  const stage1 = await page.evaluate(async () => {
    const adapter = window.weblinuxAdapter;
    const m = await adapter.loadManifest('ubuntu');
    await adapter.downloadAssets(m);
    await adapter.boot({
      manifest: m,
      desktop: 'cli',
      enableAudio: false,
      enableNetworking: false,
      enableGpu: false,
      autostartDesktop: false,
      screenCanvas: document.createElement('canvas'),
      displayContainer: document.createElement('div'),
    });
    await new Promise(r => setTimeout(r, 6000));
    const r1 = await adapter.runCommand('cat /ubuntu/root/persisted.txt', 5000);
    const writeRes = await adapter.runCommand('echo "Ubuntu Session 2 Marker" >> /ubuntu/root/persisted.txt; sync', 5000);
    const readUpdated = await adapter.runCommand('cat /ubuntu/root/persisted.txt', 5000);
    await new Promise(r => setTimeout(r, 2500));
    await adapter.shutdown();
    return { initialFile: r1.stdout, updatedFile: readUpdated.stdout };
  });

  console.log('  Initial /ubuntu/root/persisted.txt:\n    ' + (stage1.initialFile || 'None').trim());
  console.log('  Updated /ubuntu/root/persisted.txt:\n    ' + (stage1.updatedFile || 'None').trim());

  await page.waitForTimeout(1500);

  // --- STAGE 2: BOOT DEBIAN 13 (TRIXIE) ---
  console.log('\n[STAGE 2] Booting Debian GNU/Linux 13 (Trixie) baseline...');
  const stage2 = await page.evaluate(async () => {
    const adapter = window.weblinuxAdapter;
    const m = await adapter.loadManifest('debian');
    await adapter.downloadAssets(m);
    await adapter.boot({
      manifest: m,
      desktop: 'kde-plasma',
      enableAudio: false,
      enableNetworking: false,
      enableGpu: false,
      autostartDesktop: false,
      screenCanvas: document.createElement('canvas'),
      displayContainer: document.createElement('div'),
    });
    await new Promise(r => setTimeout(r, 6000));
    const resOs = await adapter.runCommand('debian cat /etc/os-release', 5000);
    // Check if Ubuntu persistence file exists in Debian (IT MUST NOT EXIST!)
    const checkLeak = await adapter.runCommand('ls -la /debian/root/persisted.txt', 5000);
    // Write Debian marker
    await adapter.runCommand('echo "Debian Baseline Verified" > /debian/root/debian-state.txt; sync', 5000);
    const readDebian = await adapter.runCommand('cat /debian/root/debian-state.txt', 5000);
    await new Promise(r => setTimeout(r, 2500));
    await adapter.shutdown();
    return {
      debianOs: resOs.stdout,
      isolationCheck: checkLeak.stdout,
      debianFile: readDebian.stdout,
    };
  });

  console.log('  Debian OS:\n    ' + (stage2.debianOs ? stage2.debianOs.split('\n')[0] : 'None'));
  console.log('  Isolation verification (Ubuntu file in Debian?):\n    ' + stage2.isolationCheck.trim());
  console.log('  Debian persistent state:\n    ' + stage2.debianFile.trim());

  await page.waitForTimeout(1500);

  // --- STAGE 3: SWITCH BACK TO UBUNTU ---
  console.log('\n[STAGE 3] Switching back to Ubuntu 24.04.5 LTS...');
  const stage3 = await page.evaluate(async () => {
    const adapter = window.weblinuxAdapter;
    const m = await adapter.loadManifest('ubuntu');
    await adapter.downloadAssets(m);
    await adapter.boot({
      manifest: m,
      desktop: 'cli',
      enableAudio: false,
      enableNetworking: false,
      enableGpu: false,
      autostartDesktop: false,
      screenCanvas: document.createElement('canvas'),
      displayContainer: document.createElement('div'),
    });
    await new Promise(r => setTimeout(r, 6000));
    const resUbuntuFile = await adapter.runCommand('cat /ubuntu/root/persisted.txt', 5000);
    const checkDebianInUbuntu = await adapter.runCommand('ls -la /ubuntu/root/debian-state.txt', 5000);
    const finalUname = await adapter.runCommand('ubuntu uname -a', 5000);
    return {
      ubuntuPersistentFile: resUbuntuFile.stdout,
      debianLeakCheck: checkDebianInUbuntu.stdout,
      finalUname: finalUname.stdout,
    };
  });

  console.log('  Ubuntu Persistent File after 2-way switch:\n    ' + stage3.ubuntuPersistentFile.trim());
  console.log('  Isolation verification (Debian file in Ubuntu?):\n    ' + stage3.debianLeakCheck.trim());
  console.log('  Final Ubuntu kernel query:\n    ' + stage3.finalUname.trim());

  // Capture final screenshot
  const shot = path.join(SCREENSHOT_DIR, '08-distro-switching-verified.png');
  await page.screenshot({ path: shot });
  console.log(`  ✓ Screenshot: ${shot}`);

  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.copyFileSync(shot, path.join(ARTIFACT_DIR, '08-distro-switching-verified.png'));
  }

  const switchingReport = {
    timestamp: new Date().toISOString(),
    stage1_ubuntu: stage1,
    stage2_debian: stage2,
    stage3_ubuntu_return: stage3,
    isolation_passed: stage2.isolationCheck.includes('No such file') && stage3.debianLeakCheck.includes('No such file'),
    persistence_passed: stage3.ubuntuPersistentFile.includes('Ubuntu Session 2 Marker'),
  };

  const reportPath = path.resolve(__dirname, '../../switching-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(switchingReport, null, 2));
  console.log(`\n✓ Switching report saved: ${reportPath}`);

  console.log('================================================================');
  console.log(`ISOLATION VERIFIED: ${switchingReport.isolation_passed ? 'YES (100% ISOLATED)' : 'FAILED'}`);
  console.log(`PERSISTENCE VERIFIED: ${switchingReport.persistence_passed ? 'YES (100% PERSISTENT)' : 'FAILED'}`);
  console.log('================================================================\n');

  await browser.close();
  process.exit(switchingReport.isolation_passed && switchingReport.persistence_passed ? 0 : 1);
}

run().catch(err => {
  console.error('Switching test failed:', err);
  process.exit(1);
});
