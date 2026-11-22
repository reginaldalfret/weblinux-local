const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/playwright-verification');
const ARTIFACT_DIR = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1';
const PROFILE_DIR = path.resolve(__dirname, `.pw-profile-${Date.now()}`);

async function runPlaywrightVerification() {
  console.log('================================================================');
  console.log('🚀 WEBLINUX LOCAL — FULL PLAYWRIGHT AUTOMATED AUDIT & VERIFICATION');
  console.log('================================================================\n');

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const testReport = {
    timestamp: new Date().toISOString(),
    playwrightVersion: require('playwright/package.json').version,
    browser: 'Microsoft Edge',
    checks: {},
    guestInfo: {},
    screenshots: {},
    summary: 'PENDING'
  };

  // 1. Check HTTP & Headers
  console.log('--- STEP 1: Verifying Local Server & Security Headers ---');
  try {
    const res = await fetch('http://localhost:3000');
    const coop = res.headers.get('cross-origin-opener-policy');
    const coep = res.headers.get('cross-origin-embedder-policy');
    console.log(`✓ HTTP Status: ${res.status}`);
    console.log(`✓ COOP Header: ${coop}`);
    console.log(`✓ COEP Header: ${coep}`);

    testReport.checks.serverOnline = res.status === 200;
    testReport.checks.coopHeaderValid = coop === 'same-origin';
    testReport.checks.coepHeaderValid = coep === 'require-corp';
    if (!testReport.checks.serverOnline || !testReport.checks.coopHeaderValid || !testReport.checks.coepHeaderValid) {
      throw new Error('Security headers or server check failed!');
    }
  } catch (err) {
    console.error('Server check failed:', err);
    testReport.checks.serverOnline = false;
    throw err;
  }

  // 2. Launch Browser via Playwright
  console.log('\n--- STEP 2: Launching Microsoft Edge via Playwright ---');
  const browserContext = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1600, height: 1000 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-features=SharedArrayBuffer',
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=default',
      '--window-size=1600,1000',
    ],
  });

  const page = browserContext.pages()[0] || await browserContext.newPage();
  await page.setViewportSize({ width: 1600, height: 1000 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('display:') || text.includes('splash:') || text.includes('plasma:') || text.includes('Kernel')) {
      console.log(`   [Browser Console] ${text}`);
    }
  });

  page.on('pageerror', err => {
    console.warn(`   [Browser PageError] ${err.message}`);
  });

  try {
    // 3. Inspect Landing Page
    console.log('\n--- STEP 3: Inspecting Landing Page & Distro Catalogue ---');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    const landingTitle = await page.title();
    console.log(`✓ Page Title: "${landingTitle}"`);

    // Check Landing page elements
    const distroCount = await page.evaluate(() => {
      const distros = document.querySelectorAll('.grid > div');
      return distros.length;
    });
    console.log(`✓ Distro catalogue entries found: ${distroCount}`);

    const landingShot = path.join(SCREENSHOT_DIR, '01-landing-page.png');
    await page.screenshot({ path: landingShot });
    testReport.screenshots.landingPage = landingShot;
    testReport.checks.landingPageLoaded = true;

    // 4. Click "Launch WebLinux" to start Debian + KDE Plasma
    console.log('\n--- STEP 4: Initiating Debian GNU/Linux 13 & KDE Plasma 6 Boot ---');
    const launchBtn = page.locator('button:has-text("Launch WebLinux")').first();
    await launchBtn.click();
    console.log('✓ "Launch WebLinux" clicked.');

    // 5. Monitor Boot Sequence
    console.log('\n--- STEP 5: Monitoring Linux-WASM Kernel Boot & OPFS Mount ---');
    let shellReady = false;
    let autostartDetected = false;
    let bootLogs = '';

    for (let i = 0; i < 90; i++) {
      await page.waitForTimeout(1000);
      const bootStatus = await page.evaluate(() => {
        const a = window.weblinuxAdapter;
        if (!a) return { ready: false, out: '', state: '' };
        return {
          ready: a.getStatus ? a.getStatus().shellReady : false,
          out: a.getOutput ? a.getOutput() : '',
          state: a.getStatus ? a.getStatus().state : '',
        };
      });

      if (bootStatus.out.includes('autostart: the desktop') || (bootStatus.ready && bootStatus.out.includes('EXT4-fs (wda)'))) {
        shellReady = true;
        autostartDetected = true;
        bootLogs = bootStatus.out;
        console.log(`✓ Linux guest booted & Debian rootfs mounted (T+${i}s)!`);
        break;
      }
    }

    testReport.checks.linuxKernelBooted = shellReady;
    testReport.checks.autostartDetected = autostartDetected;

    const bootingShot = path.join(SCREENSHOT_DIR, '02-boot-screen.png');
    await page.screenshot({ path: bootingShot });
    testReport.screenshots.booting = bootingShot;

    // 6. Monitor Wayland Window Server & WebGL2 Compositor
    console.log('\n--- STEP 6: Verifying Wayland Compositor (wlserver) & WebGL2 ---');
    let waylandActive = false;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000);
      const active = await page.evaluate(() => window.rvDisplay ? window.rvDisplay.active() : false);
      if (active) {
        waylandActive = true;
        console.log(`✓ Wayland window server active on BroadcastChannel (T+${i}s)!`);
        break;
      }
    }

    testReport.checks.waylandCompositorActive = waylandActive;

    // Check Canvas in DOM
    const domCanvas = await page.evaluate(() => {
      const stage = document.getElementById('rv-stage');
      const canvas = document.getElementById('display-canvas');
      const sc = document.getElementById('screen');
      return {
        stageExists: !!stage,
        stageDisplay: stage ? stage.style.display : null,
        canvasExists: !!canvas,
        canvasDisplay: canvas ? canvas.style.display : null,
        canvasW: canvas ? canvas.width : 0,
        canvasH: canvas ? canvas.height : 0,
        screenW: sc ? sc.clientWidth : 0,
        screenH: sc ? sc.clientHeight : 0,
      };
    });
    console.log('✓ DOM Canvas Layout:', JSON.stringify(domCanvas));
    testReport.checks.canvasMounted = domCanvas.canvasExists && domCanvas.canvasDisplay === 'block';

    // 7. Observe KDE Plasma Splash Screen & Transition to Wallpaper
    console.log('\n--- STEP 7: Observing KDE Plasma Lifecycle & Desktop Wallpaper ---');
    let splashSeen = false;
    let desktopWallpaperSeen = false;

    // Wait through splash screen to wallpaper presentation
    for (let i = 0; i < 110; i++) {
      await page.waitForTimeout(1000);
      const splashState = await page.evaluate(() => {
        const sp = window.rvSplash ? window.rvSplash.state() : null;
        const d = window.rvDisplay;
        return {
          shown: sp ? sp.shown : false,
          text: sp ? sp.text : '',
          active: d ? d.active() : false,
        };
      });

      if (splashState.shown && !splashSeen) {
        splashSeen = true;
        console.log(`✓ KDE Plasma Splash Screen active: "${splashState.text}"`);
        const splashShot = path.join(SCREENSHOT_DIR, '03-plasma-splash.png');
        await page.screenshot({ path: splashShot });
        testReport.screenshots.splashScreen = splashShot;
      }

      if (splashSeen && !splashState.shown && splashState.active) {
        desktopWallpaperSeen = true;
        console.log(`✓ KDE Plasma Splash faded out -> Desktop Wallpaper Presented! (T+${i}s)`);
        break;
      }
    }

    testReport.checks.plasmaSplashPresented = splashSeen;
    testReport.checks.desktopWallpaperPresented = desktopWallpaperSeen;

    // 8. Execute Linux Guest Commands via Terminal
    console.log('\n--- STEP 8: Executing Real Linux Guest Verification Commands ---');
    const guestCommands = [
      { name: 'Kernel Version', cmd: 'debian uname -a' },
      { name: 'Uptime & Load', cmd: 'debian uptime' },
      { name: 'Memory Usage', cmd: 'debian free -m' },
      { name: 'CPU Architecture', cmd: 'debian lscpu || debian cat /proc/cpuinfo' },
      { name: 'Active Processes', cmd: 'debian ps aux | grep -E "desktop|wlserver|dbus|plasma|pulseaudio"' },
    ];

    for (const item of guestCommands) {
      console.log(`\n> Executing: ${item.cmd}`);
      const res = await page.evaluate(async (c) => {
        if (!window.weblinuxAdapter) return 'NO ADAPTER';
        return await window.weblinuxAdapter.runCommand(c, 10000);
      }, item.cmd);
      const out = res.out ? res.out.trim() : String(res);
      console.log(out);
      testReport.guestInfo[item.name] = out;
    }

    // 9. Capture Final Master Screenshot
    console.log('\n--- STEP 9: Capturing Final Live Desktop Screenshot ---');
    const finalShot = path.join(SCREENSHOT_DIR, '04-live-debian-kde-desktop.png');
    await page.screenshot({ path: finalShot });
    const stat = fs.statSync(finalShot);
    console.log(`✓ Final Master Screenshot: ${finalShot} (${stat.size} bytes)`);
    testReport.screenshots.finalDesktop = finalShot;

    // Copy to artifact directory
    const artifactFinal = path.join(ARTIFACT_DIR, 'playwright-final-desktop.png');
    fs.copyFileSync(finalShot, artifactFinal);
    console.log(`✓ Artifact updated: ${artifactFinal}`);

    // Final assessment
    const allPassed = Object.values(testReport.checks).every(Boolean);
    testReport.summary = allPassed ? 'ALL_CHECKS_PASSED' : 'PARTIAL_OR_FAILED';

    console.log('\n================================================================');
    console.log(`🎉 PLAYWRIGHT AUDIT COMPLETE — STATUS: ${testReport.summary}`);
    console.log('================================================================');
    console.log(JSON.stringify(testReport.checks, null, 2));

    // Write full report
    const reportPath = path.resolve(__dirname, 'playwright-audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2));
    console.log(`\nAudit report written to: ${reportPath}`);

  } finally {
    // Keep browser open on host screen
    console.log('\n>>> Microsoft Edge is left open and running on your screen. <<<');
  }
}

runPlaywrightVerification().catch(err => {
  console.error('Playwright verification fatal error:', err);
  process.exit(1);
});
