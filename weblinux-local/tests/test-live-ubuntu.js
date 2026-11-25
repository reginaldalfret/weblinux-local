/**
 * WEBLINUX LOCAL — PHASE 6.3: UBUNTU 24.04.5 LTS LIVE BOOT & CLI TEST
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
  console.log('🚀 WEBLINUX LOCAL — UBUNTU 24.04.5 LTS RUNTIME & BOOT TEST');
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
    if (txt.includes('[Kernel]') || txt.includes('[Boot') || txt.includes('[Runtime]') || txt.includes('[Wasm') || txt.includes('autostart:')) {
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
    // Try navbar
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

  // Take screenshot of desktop selector
  const desktopShot = path.join(SCREENSHOT_DIR, '02-ubuntu-cli-selector.png');
  await page.screenshot({ path: desktopShot });
  console.log(`✓ Environment Selector screenshot saved: ${desktopShot}`);

  // Launch Ubuntu CLI
  console.log('[Step 5] Triggering Ubuntu CLI Boot...');
  const launchBtn = page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first();
  await launchBtn.click();
  console.log('✓ Launch button clicked.');

  // Wait for boot screen and log streaming
  console.log('[Step 6] Monitoring boot progression...');
  let bootDone = false;
  for (let i = 0; i < 40; i++) {
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
        outputTail: adapter.bootOutput ? adapter.bootOutput.slice(-300) : '',
      };
    });

    if (i % 5 === 0 || status.state === 'running' || status.shellReady) {
      console.log(`  State: ${status.state} | ShellReady: ${status.shellReady} | Uptime: ${status.uptime}s`);
    }

    if (status.state === 'running' || status.shellReady) {
      bootDone = true;
      break;
    }
  }

  // Capture screenshot during / after boot
  const bootShot = path.join(SCREENSHOT_DIR, '03-ubuntu-booted.png');
  await page.screenshot({ path: bootShot });
  console.log(`✓ Booted screenshot saved: ${bootShot}`);

  // Execute guest commands inside Ubuntu
  console.log('\n[Step 7] Executing guest commands via weblinuxAdapter.runCommand...');
  const testCommands = [
    { label: 'OS Release', cmd: 'ubuntu cat /etc/os-release' },
    { label: 'Kernel Version', cmd: 'ubuntu uname -a' },
    { label: 'User Identity', cmd: 'ubuntu id' },
    { label: 'Filesystem Mounts', cmd: 'ubuntu df -h' },
    { label: 'DPKG Version', cmd: 'ubuntu dpkg --version' },
    { label: 'APT Version', cmd: 'ubuntu apt --version' },
    { label: 'Ubuntu Directory Contents', cmd: 'ls -la /ubuntu' },
    { label: 'Write Persistence Test', cmd: 'echo "WebLinux Ubuntu 24.04.5 Persistence Verified" > /ubuntu/root/phase6-test.txt && cat /ubuntu/root/phase6-test.txt' },
  ];

  const results = {};
  for (const tc of testCommands) {
    try {
      console.log(`  > Executing: ${tc.cmd}`);
      const res = await page.evaluate(async (command) => {
        if (!window.weblinuxAdapter) return { error: 'no adapter' };
        return await window.weblinuxAdapter.runCommand(command, 15000);
      }, tc.cmd);
      
      const out = res.stdout ? res.stdout.trim() : (res.out || JSON.stringify(res));
      results[tc.label] = { command: tc.cmd, output: out, exitCode: res.exitCode };
      console.log(`    Output: ${out.replace(/\n/g, '\n    ')}`);
    } catch (err) {
      console.error(`    Error on ${tc.label}:`, err.message);
      results[tc.label] = { command: tc.cmd, error: err.message };
    }
  }

  // Capture final interactive terminal screenshot
  const finalShot = path.join(SCREENSHOT_DIR, '04-ubuntu-terminal-session.png');
  await page.screenshot({ path: finalShot });
  console.log(`✓ Final Terminal screenshot saved: ${finalShot}`);

  // Copy screenshots to artifact directory
  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.copyFileSync(distroShot, path.join(ARTIFACT_DIR, '01-distro-selector-ubuntu.png'));
    fs.copyFileSync(desktopShot, path.join(ARTIFACT_DIR, '02-ubuntu-cli-selector.png'));
    fs.copyFileSync(bootShot, path.join(ARTIFACT_DIR, '03-ubuntu-booted.png'));
    fs.copyFileSync(finalShot, path.join(ARTIFACT_DIR, '04-ubuntu-terminal-session.png'));
    console.log('✓ Copied screenshots to artifact directory.');
  }

  // Save report
  const reportPath = path.resolve(__dirname, 'ubuntu-boot-result.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    bootSuccess: bootDone,
    results
  }, null, 2));
  console.log(`✓ Test report written to ${reportPath}`);

  await browser.close();
  console.log('\n================================================================');
  console.log('TEST COMPLETE');
  console.log('================================================================');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
