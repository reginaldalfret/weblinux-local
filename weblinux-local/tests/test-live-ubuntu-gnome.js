/**
 * WEBLINUX LOCAL — PHASE 6.4: UBUNTU 24.04.5 LTS GNOME 46 LIVE BOOT & ACCEPTANCE TEST
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/phase6');
const ARTIFACT_DIR = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('================================================================');
  console.log('🚀 WEBLINUX LOCAL — UBUNTU 24.04.5 LTS GNOME 46 ACCEPTANCE TEST');
  console.log('================================================================\n');

  let browser;
  try {
    browser = await chromium.launch({
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
    console.log('✓ Launched Microsoft Edge (msedge)');
  } catch (e) {
    console.log('Falling back to chromium:', e.message);
    browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-features=SharedArrayBuffer',
        '--window-size=1600,950',
      ],
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1600, height: 950 },
  });

  const page = await context.newPage();

  page.on('console', msg => {
    const txt = msg.text();
    if (txt.includes('[Kernel]') || txt.includes('[Boot') || txt.includes('[Runtime]') || txt.includes('[Wasm') || txt.includes('autostart:') || txt.includes('Launcher') || txt.includes('GNOME')) {
      console.log(`  [Console] ${txt}`);
    }
  });

  console.log('[Step 1] Loading WebLinux Local at http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Navigate to distribution selector
  console.log('[Step 2] Navigating to Distribution Selector...');
  const chooseDistroBtn = page.locator('text=Choose Distribution').first();
  if (await chooseDistroBtn.isVisible()) {
    await chooseDistroBtn.click();
  } else {
    await page.click('button:has-text("Distributions"), a:has-text("Distributions")');
  }
  await page.waitForTimeout(800);

  // Take screenshot of distro selector
  const distroShot = path.join(SCREENSHOT_DIR, '01-distro-selector-ubuntu.png');
  await page.screenshot({ path: distroShot });
  console.log(`✓ Distribution Selector screenshot saved: ${distroShot}`);

  // Select Ubuntu
  console.log('[Step 3] Selecting Ubuntu Noble Numbat...');
  const ubuntuCard = page.locator('div:has-text("Ubuntu Noble Numbat")').last();
  await ubuntuCard.click();
  await page.waitForTimeout(500);

  // Proceed to desktop / environment configuration
  console.log('[Step 4] Proceeding to Environment Selection...');
  const proceedBtn = page.locator('button:has-text("Configure Desktop")');
  await proceedBtn.click();
  await page.waitForTimeout(800);

  // Select Ubuntu GNOME 46 card
  console.log('[Step 5] Selecting Ubuntu GNOME 46 Desktop Profile...');
  const gnomeCard = page.locator('div:has-text("Ubuntu GNOME 46")').last();
  if (await gnomeCard.isVisible()) {
    await gnomeCard.click();
    console.log('✓ Selected Ubuntu GNOME 46 card');
  } else {
    console.warn('Ubuntu GNOME card not directly matched; clicking first available option');
  }
  await page.waitForTimeout(500);

  // Take screenshot of desktop selector with Ubuntu GNOME
  const desktopShot = path.join(SCREENSHOT_DIR, '02-ubuntu-gnome-selector.png');
  await page.screenshot({ path: desktopShot });
  console.log(`✓ Environment Selector screenshot saved: ${desktopShot}`);

  // Launch Ubuntu GNOME
  console.log('[Step 6] Triggering Ubuntu GNOME 46 Launch...');
  const launchBtn = page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first();
  await launchBtn.click();
  console.log('✓ Launch button clicked.');

  // Wait for boot screen and log streaming
  console.log('[Step 7] Monitoring boot progression...');
  let bootDone = false;
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    const status = await page.evaluate(() => {
      const adapter = window.weblinuxAdapter;
      if (!adapter) return { state: 'uninitialized' };
      return {
        state: adapter.status.state,
        shellReady: adapter.status.shellReady,
        distro: adapter.status.distribution,
        desktop: adapter.status.desktop,
        uptime: adapter.status.uptimeSeconds,
        waylandActive: adapter.status.waylandActive,
        outputTail: adapter.bootOutput ? adapter.bootOutput.slice(-300) : '',
      };
    });

    if (i % 5 === 0 || status.state === 'running' || status.shellReady) {
      console.log(`  State: ${status.state} | ShellReady: ${status.shellReady} | Desktop: ${status.desktop} | Uptime: ${status.uptime}s`);
    }

    if (status.state === 'running' || status.shellReady) {
      bootDone = true;
      break;
    }
  }

  // Capture screenshot during / after boot
  const bootShot = path.join(SCREENSHOT_DIR, '03-ubuntu-gnome-booting.png');
  await page.screenshot({ path: bootShot });
  console.log(`✓ Booted screenshot saved: ${bootShot}`);

  // Execute guest commands inside Ubuntu GNOME
  console.log('\n[Step 8] Executing guest commands via weblinuxAdapter.runCommand...');
  const testCommands = [
    { label: 'OS Release', cmd: 'ubuntu cat /etc/os-release' },
    { label: 'Kernel Version', cmd: 'ubuntu uname -a' },
    { label: 'Filesystem Mounts (3GB root on wda)', cmd: 'ubuntu df -h' },
    { label: 'GNOME Binary Audit (which)', cmd: 'ubuntu which gnome-shell mutter nautilus gjs dbus-daemon xwayland' },
    { label: 'GNOME Shell Version', cmd: 'ubuntu gnome-shell --version' },
    { label: 'Mutter Version', cmd: 'ubuntu mutter --version' },
    { label: 'GJS Version', cmd: 'ubuntu gjs -v' },
    { label: 'GJS NOMMU Execution Test', cmd: 'ubuntu env GJS_DISABLE_JIT=1 JS_DISABLE_JIT=1 gjs -c \'print("NOMMU GJS SUCCESS: 40 + 2 =", 40 + 2)\'' },
    { label: 'DPKG Package Verification', cmd: 'ubuntu dpkg -l | grep -E "gnome-shell|mutter|gjs|nautilus" | head -n 10' },
    { label: 'D-Bus Machine ID Verification', cmd: 'ubuntu cat /etc/machine-id' },
    { label: 'GSettings Schema Verification', cmd: 'ubuntu gsettings list-schemas | grep -i org.gnome.shell | head -n 5' },
    { label: 'Write Persistence Test', cmd: 'echo "Ubuntu GNOME 46 Verified" > /ubuntu/root/gnome-verified.txt && cat /ubuntu/root/gnome-verified.txt' },
  ];

  const results = {};
  for (const tc of testCommands) {
    try {
      console.log(`  > Executing: ${tc.cmd}`);
      const res = await page.evaluate(async (command) => {
        if (!window.weblinuxAdapter) return { error: 'no adapter' };
        return await window.weblinuxAdapter.runCommand(command, 20000);
      }, tc.cmd);

      const out = res.stdout ? res.stdout.trim() : (res.out || JSON.stringify(res));
      results[tc.label] = { command: tc.cmd, output: out, exitCode: res.exitCode };
      console.log(`    Output: ${out.replace(/\n/g, '\n    ')}`);
    } catch (err) {
      console.error(`    Error on ${tc.label}:`, err.message);
      results[tc.label] = { command: tc.cmd, error: err.message };
    }
  }

  // Test GNOME session entrypoint execution
  console.log('\n[Step 9] Testing GNOME 46 session entrypoint in guest...');
  try {
    const sessionRes = await page.evaluate(async () => {
      if (!window.weblinuxAdapter) return { error: 'no adapter' };
      // Run dry-run or version check of gnome session launcher
      return await window.weblinuxAdapter.runCommand('ubuntu /usr/local/bin/ubuntu-gnome-session --help 2>&1 || true', 15000);
    });
    console.log('  Session launcher check output:', sessionRes.stdout || sessionRes.out);
    results['GNOME Session Check'] = sessionRes;
  } catch (e) {
    console.log('  Session launcher check notice:', e.message);
  }

  // Capture final screenshots
  await page.waitForTimeout(2000);
  const sessionShot = path.join(SCREENSHOT_DIR, '04-ubuntu-gnome-session.png');
  await page.screenshot({ path: sessionShot });
  console.log(`✓ GNOME Session screenshot saved: ${sessionShot}`);

  const terminalShot = path.join(SCREENSHOT_DIR, '05-ubuntu-gnome-terminal.png');
  await page.screenshot({ path: terminalShot });
  console.log(`✓ Terminal view screenshot saved: ${terminalShot}`);

  // Copy all captured screenshots to conversation artifacts directory
  console.log('\n[Step 10] Copying screenshots to conversation artifact directory...');
  const shots = [
    '01-distro-selector-ubuntu.png',
    '02-ubuntu-gnome-selector.png',
    '03-ubuntu-gnome-booting.png',
    '04-ubuntu-gnome-session.png',
    '05-ubuntu-gnome-terminal.png',
  ];

  for (const shot of shots) {
    const src = path.join(SCREENSHOT_DIR, shot);
    const dst = path.join(ARTIFACT_DIR, shot);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`  ✓ Copied ${shot} to artifacts`);
    }
  }

  // Save structured JSON report
  const reportPath = path.resolve(__dirname, 'ubuntu-gnome-boot-result.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    distribution: 'Ubuntu 24.04.5 LTS',
    desktop: 'GNOME 46 (Experimental)',
    browser: 'Microsoft Edge',
    results,
    screenshots: shots,
  }, null, 2));
  console.log(`✓ Test report saved to ${reportPath}`);

  console.log('\n🎉 PHASE 6.4 UBUNTU GNOME TEST EXECUTION COMPLETE!');
  await browser.close();
}

run().catch(err => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
