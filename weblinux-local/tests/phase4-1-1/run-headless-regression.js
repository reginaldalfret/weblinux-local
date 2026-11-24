/**
 * WebLinux Phase 4.1.1 - Full Automated Regression & Acceptance Runner
 * Coordinates all test specifications with strict assertions and no hardcoded results.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const { TestRecorder } = require('./helpers/TestRecorder');
const { runApplicationLoadRegression } = require('./regression/application-load.spec');
const { runGuestCommandRegression } = require('./regression/guest-commands.spec');
const { runKonsoleGuiSpec } = require('./gui/konsole.spec');
const { runDolphinGuiSpec } = require('./gui/dolphin.spec');
const { runWindowManagementGuiSpec } = require('./gui/window-management.spec');
const { runOpfsTests } = require('./storage/opfs-tests.spec');
const { runVisibleEdgeSpec } = require('./run-visible-edge');

(async () => {
  console.log('========================================================================');
  console.log('🚀 WEBLINUX LOCAL — PHASE 4.1.1 AUTOMATED ACCEPTANCE SUITE');
  console.log('========================================================================\n');

  const DOCS_DIR = path.resolve(__dirname, '../../docs/phase4-1-1');
  const SCREENSHOT_DIR = path.join(DOCS_DIR, 'screenshots');
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const BASE_PROFILE_DIR = path.resolve(__dirname, '.phase4-1-1-profiles');
  if (!fs.existsSync(BASE_PROFILE_DIR)) {
    fs.mkdirSync(BASE_PROFILE_DIR, { recursive: true });
  }

  const MAIN_PROFILE = path.join(BASE_PROFILE_DIR, 'main-profile');
  fs.mkdirSync(MAIN_PROFILE, { recursive: true });

  const recorder = new TestRecorder('WebLinux Local Phase 4.1.1 Acceptance Suite', {
    browserMode: 'Automated Headless & Protocol Integration'
  });

  console.log('[STAGE 1] Launching Browser and Booting WebLinux Debian 13...');
  const launchOptions = {
    headless: true,
    args: ['--enable-features=SharedArrayBuffer', '--no-sandbox', '--disable-setuid-sandbox']
  };
  if (process.env.PLAYWRIGHT_CHANNEL) {
    launchOptions.channel = process.env.PLAYWRIGHT_CHANNEL;
  } else if (process.platform === 'win32') {
    launchOptions.channel = 'msedge';
  }
  const context = await chromium.launchPersistentContext(MAIN_PROFILE, launchOptions);

  const page = context.pages()[0] || await context.newPage();
  await page.setViewportSize({ width: 1600, height: 900 });

  // 01-edge-web-linux-start.png
  await page.goto('http://localhost:3000');
  const shotPath01 = path.join(SCREENSHOT_DIR, '01-edge-web-linux-start.png');
  await page.screenshot({ path: shotPath01 });
  console.log('  ✓ Saved 01-edge-web-linux-start.png');

  // Trigger Launch
  await page.click('button:has-text("Launch WebLinux")');

  console.log('Waiting for guest kernel and Wayland compositor to reach running state...');
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  // Allow KDE Plasma 6 splash to settle
  console.log('Waiting 35s for KDE Plasma 6 splash sequence to settle...');
  await page.waitForTimeout(35000);

  // 02-debian-kde-desktop.png
  const shotPath02 = path.join(SCREENSHOT_DIR, '02-debian-kde-desktop.png');
  await page.screenshot({ path: shotPath02 });
  console.log('  ✓ Saved 02-debian-kde-desktop.png');

  // 03-kde-application-launcher.png
  console.log('Triggering application launcher...');
  await page.keyboard.press('Meta');
  await page.waitForTimeout(1200);
  const shotPath03 = path.join(SCREENSHOT_DIR, '03-kde-application-launcher.png');
  await page.screenshot({ path: shotPath03 });
  console.log('  ✓ Saved 03-kde-application-launcher.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // STAGE 2: Environment & Load Regression
  await runApplicationLoadRegression(page, recorder);

  // STAGE 3: Guest API Command Regression
  await runGuestCommandRegression(page, recorder);

  // STAGE 4: Konsole GUI Spec
  await runKonsoleGuiSpec(page, recorder, SCREENSHOT_DIR);

  // STAGE 5: Dolphin GUI Spec
  await runDolphinGuiSpec(page, recorder, SCREENSHOT_DIR);

  // STAGE 6: Window Management Spec
  await runWindowManagementGuiSpec(page, recorder, SCREENSHOT_DIR);

  // 18-fullscreen-desktop.png: Viewport Fullscreen Negotiation
  console.log('\n--- TESTING DYNAMIC FULLSCREEN NEGOTIATION ---');
  const tFull = performance.now();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(2000);
  const shotPath18 = path.join(SCREENSHOT_DIR, '18-fullscreen-desktop.png');
  await page.screenshot({ path: shotPath18 });
  const elapsedFull = Math.round(performance.now() - tFull);

  const canvasBox = await page.evaluate(() => {
    const c = document.querySelector('canvas#screen') || document.querySelector('canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height) };
  });

  const fullPassed = canvasBox && canvasBox.width >= 1600;
  recorder.record(
    'GUI-DISPLAY-01',
    'Dynamic Viewport Fullscreen Scaling (1920x1080)',
    'regression',
    fullPassed,
    fullPassed ? `Display canvas scaled to ${canvasBox.width}x${canvasBox.height}` : 'Canvas failed to scale',
    [shotPath18],
    elapsedFull
  );

  // Clean shutdown of main session
  console.log('\nShutting down main session...');
  await page.evaluate(async () => {
    await window.weblinuxAdapter.runCommand('sync', 3000);
    if (window.weblinuxAdapter.shutdown) await window.weblinuxAdapter.shutdown();
  });
  await page.waitForTimeout(1500);
  await context.close();
  console.log('✓ Main session closed.\n');

  // STAGE 7: OPFS Persistence & Profile Isolation
  await runOpfsTests(recorder, BASE_PROFILE_DIR, SCREENSHOT_DIR);

  // STAGE 8: Mode B Visible Edge Acceptance
  await runVisibleEdgeSpec(recorder, SCREENSHOT_DIR);

  // STAGE 9: Compile Reports
  console.log('\n--- COMPILING PHASE 4.1.1 REPORTS ---');
  const reportJSON = recorder.toJSON();
  const summary = recorder.getSummary();

  fs.writeFileSync(
    path.join(DOCS_DIR, 'PHASE4-1-1-ACCEPTANCE-REPORT.json'),
    JSON.stringify(reportJSON, null, 2)
  );
  console.log('✓ Written docs/phase4-1-1/PHASE4-1-1-ACCEPTANCE-REPORT.json');

  // Generate Markdown Test Results
  let mdResults = `# WebLinux Local — Phase 4.1.1 Test Results\n\n`;
  mdResults += `**Generated:** ${reportJSON.endTime}  \n`;
  mdResults += `**Overall Status:** ${reportJSON.overallStatus}  \n`;
  mdResults += `**Summary:** Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Blocked: ${summary.blocked} | Not Tested: ${summary.notTested}\n\n`;
  mdResults += `| ID | Title | Category | Status | Duration (ms) | Details |\n`;
  mdResults += `|---|---|---|---|---|---|\n`;

  for (const c of reportJSON.cases) {
    const safeDetails = c.details.replace(/\|/g, '\\|');
    mdResults += `| **${c.id}** | ${c.title} | ${c.category} | \`${c.status}\` | ${c.durationMs} | ${safeDetails} |\n`;
  }

  fs.writeFileSync(path.join(DOCS_DIR, 'PHASE4-1-1-TEST-RESULTS.md'), mdResults);
  console.log('✓ Written docs/phase4-1-1/PHASE4-1-1-TEST-RESULTS.md');

  console.log('\n========================================================================');
  console.log(`🏆 PHASE 4.1.1 RUN COMPLETE: ${summary.passed}/${summary.total} PASSED (${summary.overallStatus})`);
  console.log('========================================================================\n');

  if (summary.failed > 0) {
    process.exit(1);
  }
})().catch(err => {
  console.error('Fatal Phase 4.1.1 runner error:', err);
  process.exit(1);
});
