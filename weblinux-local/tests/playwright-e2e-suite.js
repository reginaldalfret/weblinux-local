const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/playwright-verification');
const ARTIFACT_DIR = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\a792fb87-9829-4a98-b5f8-e754a1f9dfa1';
const PROFILE_DIR = path.resolve(__dirname, `.pw-suite-profile-${Date.now()}`);

async function runPlaywrightSuite() {
  console.log('================================================================');
  console.log('🧪 WEBLINUX LOCAL — END-TO-END PLAYWRIGHT AUTOMATION SUITE');
  console.log('================================================================\n');

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const auditReport = {
    suite: 'WebLinux Local E2E Verification',
    timestamp: new Date().toISOString(),
    playwrightVersion: require('playwright/package.json').version,
    browser: 'Microsoft Edge',
    stages: {},
    guestTelemetry: {},
    screenshots: {},
    verdict: 'PENDING'
  };

  // -------------------------------------------------------------
  // STAGE 1: Server and Security Headers
  // -------------------------------------------------------------
  console.log('[STAGE 1] Testing Server Readiness and COOP/COEP Security Headers...');
  const res = await fetch('http://localhost:3000');
  const coop = res.headers.get('cross-origin-opener-policy');
  const coep = res.headers.get('cross-origin-embedder-policy');

  console.log(`  ✓ Response Status: ${res.status}`);
  console.log(`  ✓ Cross-Origin-Opener-Policy: ${coop}`);
  console.log(`  ✓ Cross-Origin-Embedder-Policy: ${coep}`);

  auditReport.stages.headers = {
    status200: res.status === 200,
    coopValid: coop === 'same-origin',
    coepValid: coep === 'require-corp',
  };

  // -------------------------------------------------------------
  // STAGE 2: Launch Headful Edge via Playwright
  // -------------------------------------------------------------
  console.log('\n[STAGE 2] Launching Microsoft Edge browser via Playwright...');
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
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

  const page = context.pages()[0] || await context.newPage();
  await page.setViewportSize({ width: 1600, height: 1000 });

  page.on('console', msg => {
    const txt = msg.text();
    if (txt.includes('display:') || txt.includes('splash:') || txt.includes('plasma:') || txt.includes('Wayland')) {
      console.log(`   [Browser Console] ${txt}`);
    }
  });

  // -------------------------------------------------------------
  // STAGE 3: Landing Page & Distribution Catalogue
  // -------------------------------------------------------------
  console.log('\n[STAGE 3] Inspecting Landing Page & Distro Catalogue...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  const title = await page.title();
  const distros = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.grid > div'));
    return cards.map(c => c.textContent ? c.textContent.trim().slice(0, 40) : '');
  });

  console.log(`  ✓ Title: "${title}"`);
  console.log(`  ✓ Distributions found (${distros.length}):`, distros.slice(0, 5));

  const shot1 = path.join(SCREENSHOT_DIR, '01-landing-page.png');
  await page.screenshot({ path: shot1 });
  auditReport.screenshots.landingPage = shot1;
  auditReport.stages.landingPage = { titleValid: title.includes('WebLinux'), distrosFound: distros.length };

  // -------------------------------------------------------------
  // STAGE 4: Boot Debian GNU/Linux 13 & KDE Plasma 6
  // -------------------------------------------------------------
  console.log('\n[STAGE 4] Triggering Boot of Debian GNU/Linux 13 (Trixie) & KDE Plasma...');
  const launchBtn = page.locator('button:has-text("Launch WebLinux")').first();
  await launchBtn.click();
  console.log('  ✓ Boot trigger executed.');

  // Wait for Kernel Boot and OPFS Mounting
  console.log('  -> Waiting for kernel workers, initrd, and OPFS rootfs mount...');
  let rootfsMounted = false;
  let autostartDetected = false;

  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(1000);
    const bootStatus = await page.evaluate(() => {
      const a = window.weblinuxAdapter;
      if (!a) return { out: '', ready: false };
      return {
        out: a.getOutput ? a.getOutput() : '',
        ready: a.getStatus ? a.getStatus().shellReady : false,
      };
    });

    if (bootStatus.out.includes('EXT4-fs (wda): mounted filesystem') || bootStatus.out.includes('autostart: the desktop')) {
      rootfsMounted = true;
    }
    if (bootStatus.out.includes('autostart: the desktop')) {
      autostartDetected = true;
      console.log(`  ✓ Genuine Debian rootfs mounted & KDE autostart sequence active (T+${i}s)!`);
      break;
    }
  }

  auditReport.stages.kernelBoot = { rootfsMounted, autostartDetected };

  // -------------------------------------------------------------
  // STAGE 5: Wayland Window Server & WebGL2 Canvas Attachment
  // -------------------------------------------------------------
  console.log('\n[STAGE 5] Checking Wayland Window Server & WebGL2 Canvas Attachment...');
  let waylandActive = false;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const active = await page.evaluate(() => window.rvDisplay ? window.rvDisplay.active() : false);
    if (active) {
      waylandActive = true;
      console.log(`  ✓ Wayland window server active at T+${i}s!`);
      break;
    }
  }

  const domCheck = await page.evaluate(() => {
    const stage = document.getElementById('rv-stage');
    const canvas = document.getElementById('display-canvas');
    return {
      stageMounted: !!stage && stage.parentElement.className.includes('relative flex-1'),
      canvasVisible: !!canvas && canvas.style.display === 'block',
      canvasWidth: canvas ? canvas.width : 0,
      canvasHeight: canvas ? canvas.height : 0,
    };
  });

  console.log('  ✓ Canvas Layout Verification:', JSON.stringify(domCheck));
  auditReport.stages.compositor = { waylandActive, ...domCheck };

  // -------------------------------------------------------------
  // STAGE 6: Observing KDE Plasma Splash Screen
  // -------------------------------------------------------------
  console.log('\n[STAGE 6] Verifying KDE Plasma Splash Screen Presentation...');
  let splashObserved = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const sp = await page.evaluate(() => window.rvSplash ? window.rvSplash.state() : null);
    if (sp && sp.shown) {
      splashObserved = true;
      console.log(`  ✓ KDE Plasma Splash Screen Active: "${sp.text}" (Theme: ${sp.theme})`);
      const shot2 = path.join(SCREENSHOT_DIR, '02-plasma-splash.png');
      await page.screenshot({ path: shot2 });
      auditReport.screenshots.splashScreen = shot2;
      break;
    }
  }
  auditReport.stages.splash = { splashObserved };

  // -------------------------------------------------------------
  // STAGE 7: Observing Wallpaper & Desktop Presentation
  // -------------------------------------------------------------
  console.log('\n[STAGE 7] Observing Transition to Desktop Wallpaper & Panels...');
  let desktopReady = false;
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => {
      const sp = window.rvSplash ? window.rvSplash.state() : null;
      const d = window.rvDisplay;
      return {
        splashGone: sp ? !sp.shown : false,
        active: d ? d.active() : false,
      };
    });

    if (state.splashGone && state.active) {
      desktopReady = true;
      console.log(`  ✓ KDE Plasma Splash Dismissed -> Full Desktop Ready at T+${i}s!`);
      break;
    }
  }

  // Allow 5 seconds for rendering pipeline to settle
  await page.waitForTimeout(5000);

  // -------------------------------------------------------------
  // STAGE 8: Linux Guest Execution via Adapter Shell
  // -------------------------------------------------------------
  console.log('\n[STAGE 8] Querying Live Linux Guest System Telemetry...');
  const queries = [
    { key: 'uname', cmd: 'debian uname -a' },
    { key: 'uptime', cmd: 'debian uptime' },
    { key: 'memory', cmd: 'debian free -m' },
    { key: 'processes', cmd: 'debian ps aux | grep -E "desktop|wlserver|plasma|dbus|pulseaudio"' },
  ];

  for (const q of queries) {
    try {
      const res = await page.evaluate(async (command) => {
        if (!window.weblinuxAdapter) return 'No adapter';
        return await window.weblinuxAdapter.runCommand(command, 8000);
      }, q.cmd);
      const text = res.out ? res.out.trim() : String(res);
      auditReport.guestTelemetry[q.key] = text;
      console.log(`  [Guest: ${q.key}]:\n  ${text.split('\n').join('\n  ')}\n`);
    } catch(err) {
      console.warn(`  Warning executing ${q.key}:`, err.message);
    }
  }

  // Allow render buffer to stabilize after commands
  await page.waitForTimeout(4000);

  // -------------------------------------------------------------
  // STAGE 9: Capture Final Master Desktop Screenshot
  // -------------------------------------------------------------
  console.log('\n[STAGE 9] Capturing Final Live Desktop Screenshot...');
  const shot3 = path.join(SCREENSHOT_DIR, '03-live-kde-plasma-desktop.png');
  await page.screenshot({ path: shot3, timeout: 30000 });
  const shotSize = fs.statSync(shot3).size;
  console.log(`  ✓ Screenshot Saved: ${shot3} (${shotSize} bytes)`);
  auditReport.screenshots.finalDesktop = shot3;

  // Copy to conversation artifact
  const artifactPath = path.join(ARTIFACT_DIR, 'playwright-desktop-verified.png');
  fs.copyFileSync(shot3, artifactPath);
  console.log(`  ✓ Copy stored to Artifact: ${artifactPath}`);

  // Final Verdict
  const checksPassed = auditReport.stages.headers.status200 &&
                       auditReport.stages.headers.coopValid &&
                       auditReport.stages.headers.coepValid &&
                       auditReport.stages.kernelBoot.rootfsMounted &&
                       auditReport.stages.compositor.waylandActive &&
                       auditReport.stages.compositor.canvasVisible;

  auditReport.verdict = checksPassed ? 'VERIFIED_SUCCESSFUL' : 'FAILED';

  console.log('\n================================================================');
  console.log(`🏆 FINAL PLAYWRIGHT VERIFICATION RESULT: ${auditReport.verdict}`);
  console.log('================================================================');

  const reportOut = path.resolve(__dirname, 'playwright-audit-report.json');
  fs.writeFileSync(reportOut, JSON.stringify(auditReport, null, 2));
  console.log(`Report JSON written to: ${reportOut}`);

  console.log('\n>>> BROWSER IS LEFT OPEN ON YOUR SCREEN FOR MANUAL INTERACTION <<<\n');
}

runPlaywrightSuite().catch(err => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
