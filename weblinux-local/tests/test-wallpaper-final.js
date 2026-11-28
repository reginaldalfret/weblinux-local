#!/usr/bin/env node
/**
 * Phase 16.1 — Six-Distribution Final Wallpaper Verification Script
 *
 * Fast, focused Playwright verification for all 6 KDE distributions:
 *   - Opens http://localhost:3000 in Microsoft Edge (launchPersistentContext)
 *   - Selects and launches <distroId> through the normal WebLinux UI
 *   - Waits for shellReady + waylandActive, then waits for KDE desktop
 *     via page.evaluate canvas non-black + non-KSplash luma/buckets checks
 *     (NO runGuest compositor probes)
 *   - Captures D:\weblinux-disks\phase16-1-release-evidence\wallpaper-final\<shortName>.png
 *   - Shuts down cleanly, reloads the page (preserving OPFS), relaunches,
 *     and captures <shortName>-reboot.png
 *
 * Usage:
 *   node tests/test-wallpaper-final.js <distroId>
 *   node tests/test-wallpaper-final.js --all
 *
 * IMPORTANT: Never calls resetAll() or freshHomeDisk: true.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const {
  getHostDisplayState,
  evaluateCanvasFrame,
} = require('./helpers/desktop-readiness');

const REPO_ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = 'D:\\weblinux-disks\\phase16-1-release-evidence\\wallpaper-final';
const BASE_URL = 'http://localhost:3000';

const DISTRO_CONFIGS = {
  'debian-firefox': {
    shortName: 'debian',
    canonicalId: 'debian-kde',
    selectorText: 'Debian GNU/Linux 13 (Trixie)',
    expectedWallpaper: 'debian-trixie-logo-wallpaper.png',
    desktopWaitMs: 120000,
    rebootWaitMs: 90000,
  },
  'ubuntu-kde-epiphany': {
    shortName: 'ubuntu',
    canonicalId: 'ubuntu-kde',
    selectorText: 'Ubuntu 24.04.5 LTS KDE',
    expectedWallpaper: 'ubuntu-2404-logo-wallpaper.png',
    desktopWaitMs: 120000,
    rebootWaitMs: 90000,
  },
  'arch-kde': {
    shortName: 'arch',
    canonicalId: 'arch-kde',
    selectorText: 'Arch Linux RISC-V (Community Port + KDE Plasma 6)',
    expectedWallpaper: 'arch-linux-logo-wallpaper.png',
    desktopWaitMs: 135000,
    rebootWaitMs: 95000,
  },
  'opensuse-tumbleweed-kde': {
    shortName: 'opensuse',
    canonicalId: 'opensuse-tumbleweed-kde',
    selectorText: 'openSUSE Tumbleweed RISC-V (KDE Plasma 6)',
    expectedWallpaper: 'opensuse-tumbleweed-logo-wallpaper.png',
    desktopWaitMs: 160000,
    rebootWaitMs: 110000,
  },
  'fedora-kde': {
    shortName: 'fedora',
    canonicalId: 'fedora-kde',
    selectorText: 'Fedora 45 RISC-V (Community Build + KDE Plasma 6)',
    expectedWallpaper: 'fedora-45-logo-wallpaper.png',
    desktopWaitMs: 150000,
    rebootWaitMs: 105000,
  },
  'alpine-kde': {
    shortName: 'alpine',
    canonicalId: 'alpine-kde',
    selectorText: 'Alpine Linux',
    expectedWallpaper: 'alpine-324-logo-wallpaper.png',
    desktopWaitMs: 135000,
    rebootWaitMs: 95000,
  },
};

const ALIASES = {
  debian: 'debian-firefox',
  'debian-kde': 'debian-firefox',
  ubuntu: 'ubuntu-kde-epiphany',
  'ubuntu-kde': 'ubuntu-kde-epiphany',
  arch: 'arch-kde',
  opensuse: 'opensuse-tumbleweed-kde',
  fedora: 'fedora-kde',
  alpine: 'alpine-kde',
};

async function waitForShellAndWayland(page, timeoutSec = 180) {
  for (let i = 0; i < timeoutSec; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state || null,
      shellReady: Boolean(window.weblinuxAdapter?.status?.shellReady),
      waylandActive: Boolean(window.weblinuxAdapter?.status?.waylandActive),
      error: window.weblinuxAdapter?.status?.error || null,
    }));
    if (st.error) {
      throw new Error(`Boot error: ${st.error}`);
    }
    if (st.state === 'running' && st.shellReady && st.waylandActive) {
      return st;
    }
  }
  const finalSt = await page.evaluate(() => ({
    state: window.weblinuxAdapter?.status?.state || null,
    shellReady: Boolean(window.weblinuxAdapter?.status?.shellReady),
    waylandActive: Boolean(window.weblinuxAdapter?.status?.waylandActive),
    error: window.weblinuxAdapter?.status?.error || null,
  }));
  throw new Error(`Timed out waiting for shellReady + waylandActive: ${JSON.stringify(finalSt)}`);
}

async function selectAndLaunch(page, cfg) {
  await page.locator('button:has-text("Distributions")').waitFor({ state: 'visible', timeout: 20000 });
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(600);

  const card = page.locator(`div:has-text("${cfg.selectorText}")`).last();
  await card.waitFor({ state: 'visible', timeout: 15000 });
  await card.click();
  await page.waitForTimeout(500);

  const cfgBtn = page.locator('button:has-text("Configure Desktop")');
  await cfgBtn.waitFor({ state: 'visible', timeout: 15000 });
  await cfgBtn.click();
  await page.waitForTimeout(500);

  const launchBtn = page
    .locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")')
    .first();
  await launchBtn.waitFor({ state: 'visible', timeout: 15000 });
  await launchBtn.click();

  return await waitForShellAndWayland(page, 180);
}

async function waitForKdeDesktopCanvas(page, distroId, maxWaitMs) {
  const start = Date.now();
  let lastHost = null;
  let lastCanvas = null;
  let attempt = 0;

  while (Date.now() - start < maxWaitMs) {
    attempt++;
    lastHost = await getHostDisplayState(page);
    if (lastHost.error) {
      throw new Error(`Adapter error during desktop wait: ${lastHost.error}`);
    }

    if (lastHost.waylandActive && lastHost.rvDisplayActive && lastHost.frames > 0) {
      lastCanvas = await evaluateCanvasFrame(page, {
        minNonBlackRatio: 0.05,
        minLumaStdDev: 4.0,
        minUniqueBuckets: 6,
      });

      if (lastCanvas.isRendered) {
        const hasPlasmaDesktopWindow =
          Array.isArray(lastHost.windows) &&
          lastHost.windows.some((w) => /plasmashell|Desktop/i.test(`${w.app || ''} ${w.title || ''}`));
        const nonKsplashFrame =
          (lastCanvas.uniqueBuckets >= 60 &&
            lastCanvas.nonBlackRatio >= 0.35 &&
            lastCanvas.lumaStdDev >= 6.0) ||
          (lastCanvas.uniqueBuckets >= 80 && lastCanvas.lumaMean >= 45);
        const fallbackElapsed = Date.now() - start >= 75000 && lastHost.frames >= 30;

        const minSettleElapsed = Date.now() - start >= 85000;
        if (hasPlasmaDesktopWindow || (minSettleElapsed && (nonKsplashFrame || fallbackElapsed))) {
          // Brief settle for wallpaper + panel paint stabilization
          await page.waitForTimeout(5000);
          const settledCanvas = await evaluateCanvasFrame(page);
          return {
            ready: true,
            elapsedMs: Date.now() - start,
            reason: hasPlasmaDesktopWindow
              ? 'plasma-window'
              : nonKsplashFrame
                ? 'non-ksplash-luma-buckets'
                : 'elapsed-fallback',
            host: lastHost,
            canvas: settledCanvas,
          };
        }
      }
    }

    if (attempt % 5 === 1) {
      console.log(
        `[${distroId}] waiting for KDE desktop (${Math.round((Date.now() - start) / 1000)}s): ` +
          `frames=${lastHost.frames} nonBlack=${lastCanvas?.nonBlackRatio ?? 'n/a'} ` +
          `lumaMean=${lastCanvas?.lumaMean ?? 'n/a'} stdDev=${lastCanvas?.lumaStdDev ?? 'n/a'} ` +
          `buckets=${lastCanvas?.uniqueBuckets ?? 'n/a'}`
      );
    }
    await page.waitForTimeout(2500);
  }

  throw new Error(
    `[${distroId}] Timed out after ${maxWaitMs}ms waiting for KDE desktop canvas. ` +
      `host=${JSON.stringify(lastHost)} canvas=${JSON.stringify(lastCanvas)}`
  );
}

async function captureScreenshot(page, outPath) {
  await Promise.race([
    page.screenshot({ path: outPath, timeout: 25000, animations: 'disabled' }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot timeout 25s')), 27000)),
  ]);
  const stat = fs.statSync(outPath);
  if (stat.size === 0) {
    throw new Error(`Captured empty screenshot: ${outPath}`);
  }
  console.log(`Saved ${outPath} (${stat.size} bytes)`);
  return outPath;
}

async function verifyDistro(rawDistroId) {
  const distroId = ALIASES[rawDistroId] || rawDistroId;
  const cfg = DISTRO_CONFIGS[distroId];
  if (!cfg) {
    throw new Error(
      `Unknown distroId "${rawDistroId}". Valid values: ${Object.keys(DISTRO_CONFIGS).join(', ')}`
    );
  }

  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const profileDir = path.join(REPO_ROOT, `.tmp-edge-wpfinal-${cfg.shortName}`);
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });

  const initialShot = path.join(EVIDENCE_DIR, `${cfg.shortName}.png`);
  const rebootShot = path.join(EVIDENCE_DIR, `${cfg.shortName}-reboot.png`);

  const result = {
    distroId,
    shortName: cfg.shortName,
    canonicalId: cfg.canonicalId,
    expectedWallpaper: cfg.expectedWallpaper,
    coldBootSec: null,
    warmRebootSec: null,
    initialDesktop: null,
    rebootDesktop: null,
    screenshots: {
      initial: initialShot,
      reboot: rebootShot,
    },
    status: 'FAILED',
    error: null,
  };

  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(profileDir, {
      channel: 'msedge',
      headless: false,
      viewport: { width: 1400, height: 900 },
      args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
    });
    const page = ctx.pages()[0] || (await ctx.newPage());

    // 1. Cold boot & select distro through normal WebLinux UI
    console.log(`\n=== [${distroId}] Cold boot (${cfg.expectedWallpaper}) ===`);
    const t0 = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(800);
    await selectAndLaunch(page, cfg);
    result.coldBootSec = Number(((Date.now() - t0) / 1000).toFixed(1));
    console.log(`[${distroId}] shellReady + waylandActive in ${result.coldBootSec}s`);

    // 2. Wait for KDE desktop via canvas luma/buckets (no runGuest probes)
    result.initialDesktop = await waitForKdeDesktopCanvas(page, distroId, cfg.desktopWaitMs);
    await captureScreenshot(page, initialShot);

    // 3. Clean shutdown & page reload (preserving OPFS)
    console.log(`[${distroId}] Shutting down & reloading (preserving OPFS)...`);
    await page.evaluate(async () => {
      if (window.weblinuxAdapter?.shutdown) {
        await window.weblinuxAdapter.shutdown();
      }
    });
    await page.waitForTimeout(2000);

    const t1 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(800);
    await selectAndLaunch(page, cfg);
    result.warmRebootSec = Number(((Date.now() - t1) / 1000).toFixed(1));
    console.log(`[${distroId}] Reboot shellReady + waylandActive in ${result.warmRebootSec}s`);

    result.rebootDesktop = await waitForKdeDesktopCanvas(page, `${distroId}-reboot`, cfg.rebootWaitMs);
    await captureScreenshot(page, rebootShot);

    result.status = 'PASSED';
    return result;
  } catch (err) {
    result.error = err.message || String(err);
    return result;
  } finally {
    if (ctx) {
      await ctx.close().catch(() => {});
    }
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node tests/test-wallpaper-final.js <distroId|--all>');
    console.error('Distros:', Object.keys(DISTRO_CONFIGS).join(', '));
    process.exit(1);
  }

  const targets = arg === '--all' ? Object.keys(DISTRO_CONFIGS) : [arg];
  const results = [];
  for (const target of targets) {
    const res = await verifyDistro(target);
    results.push(res);
  }

  console.log('\n=== WALLPAPER FINAL VERIFICATION SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));

  const failed = results.filter((r) => r.status !== 'PASSED');
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
