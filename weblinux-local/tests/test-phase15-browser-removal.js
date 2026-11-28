#!/usr/bin/env node
/**
 * Phase 15 — Browser Removal, Terminal Internet & OPFS Persistence Regression Test
 * Usage: node tests/test-phase15-browser-removal.js <distroId>
 * Supported distroIds:
 *   debian-firefox, ubuntu-kde-epiphany, arch-kde, opensuse-tumbleweed-kde, fedora-kde, alpine-kde
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DISTRO_CONFIGS = {
  'debian-firefox': {
    selectorText: 'Debian GNU/Linux 13 (Trixie)',
    chrootCmd: 'debian',
    rootMount: '/debian',
    homeDir: '/root',
    pkgQueryCmd: "dpkg -l epiphany-browser epiphany chromium chromium-browser firefox firefox-esr badwolf netsurf-gtk falkon 2>/dev/null | grep -E '^ii' || true",
    pkgMetaCmd: 'apt-get update',
    plasmaWaitMs: 95000,
  },
  'ubuntu-kde-epiphany': {
    selectorText: 'Ubuntu 24.04.5 LTS KDE',
    chrootCmd: 'ubuntu-kde',
    rootMount: '/ubuntu',
    homeDir: '/home/ubuntu',
    pkgQueryCmd: "dpkg -l epiphany-browser epiphany chromium chromium-browser firefox firefox-esr badwolf netsurf-gtk falkon 2>/dev/null | grep -E '^ii' || true",
    pkgMetaCmd: 'apt-get update',
    plasmaWaitMs: 95000,
  },
  'arch-kde': {
    selectorText: 'Arch Linux RISC-V (Community Port + KDE Plasma 6)',
    chrootCmd: 'arch-root',
    rootMount: '/arch',
    homeDir: '/root',
    pkgQueryCmd: 'pacman -Q epiphany chromium firefox badwolf netsurf falkon 2>/dev/null || true',
    pkgMetaCmd: 'pacman -Sy',
    plasmaWaitMs: 110000,
  },
  'opensuse-tumbleweed-kde': {
    selectorText: 'openSUSE Tumbleweed RISC-V (KDE Plasma 6)',
    chrootCmd: 'opensuse-root',
    rootMount: '/opensuse',
    homeDir: '/root',
    pkgQueryCmd: "rpm -q epiphany chromium firefox badwolf netsurf falkon 2>/dev/null | grep -v 'is not installed' || true",
    pkgMetaCmd: 'zypper --non-interactive refresh',
    plasmaWaitMs: 145000,
  },
  'fedora-kde': {
    selectorText: 'Fedora 45 RISC-V (Community Build + KDE Plasma 6)',
    chrootCmd: 'fedora-root',
    rootMount: '/fedora',
    homeDir: '/root',
    pkgQueryCmd: "rpm -q epiphany chromium firefox badwolf netsurf falkon 2>/dev/null | grep -v 'is not installed' || true",
    pkgMetaCmd: 'dnf5 repolist',
    plasmaWaitMs: 135000,
  },
  'alpine-kde': {
    selectorText: 'Alpine Linux',
    chrootCmd: 'alpine-root',
    rootMount: '/alpine',
    homeDir: '/root',
    pkgQueryCmd: 'apk info -e epiphany chromium firefox badwolf netsurf falkon 2>/dev/null || true',
    pkgMetaCmd: 'apk update',
    plasmaWaitMs: 120000,
  },
};

const distroId = process.argv[2];
if (!distroId || !DISTRO_CONFIGS[distroId]) {
  console.error('Usage: node tests/test-phase15-browser-removal.js <distroId>');
  console.error('Valid distroIds:', Object.keys(DISTRO_CONFIGS).join(', '));
  process.exit(1);
}

const cfg = DISTRO_CONFIGS[distroId];
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'phase15');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const PROFILE_DIR = path.join(__dirname, '..', `.tmp-edge-p15-${distroId}`);

function extractSection(text, startMarker, endMarker) {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return '';
  const afterStart = text.slice(startIdx + startMarker.length);
  if (!endMarker) return afterStart.trim();
  const endIdx = afterStart.indexOf(endMarker);
  return (endIdx === -1 ? afterStart : afterStart.slice(0, endIdx)).trim();
}

async function waitForBoot(page, timeoutSec = 240) {
  for (let i = 0; i < timeoutSec; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
      waylandActive: window.weblinuxAdapter?.status?.waylandActive,
      error: window.weblinuxAdapter?.status?.error,
    }));
    if (st.error) {
      throw new Error('Boot error: ' + st.error);
    }
    if (st.state === 'running' && st.shellReady) return st;
  }
  const st = await page.evaluate(() => ({
    state: window.weblinuxAdapter?.status?.state,
    shellReady: window.weblinuxAdapter?.status?.shellReady,
    waylandActive: window.weblinuxAdapter?.status?.waylandActive,
    error: window.weblinuxAdapter?.status?.error,
  }));
  const adapterLogs = await page.evaluate(() => (window.weblinuxAdapter?.logs || []).slice(-40));
  console.error('ADAPTER_LOGS:\n' + adapterLogs.join('\n'));
  throw new Error('Timed out waiting for guest shellReady: ' + JSON.stringify(st));
}

async function selectAndLaunch(page) {
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(600);
  await page.locator(`div:has-text("${cfg.selectorText}")`).last().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(500);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();
  return await waitForBoot(page, 180);
}

async function safeScreenshot(page, outPath) {
  console.log(`Capturing screenshot ${path.basename(outPath)}...`);
  try {
    await Promise.race([
      page.screenshot({ path: outPath, timeout: 20000, animations: 'disabled' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot hard timeout 20s')), 22000)),
    ]);
    console.log(`Saved ${path.basename(outPath)}`);
    return outPath;
  } catch (err) {
    console.warn(`Screenshot failed for ${path.basename(outPath)}: ${err.message}`);
    return null;
  }
}

async function runGuest(page, innerCmd, timeoutMs = 45000) {
  const b64 = Buffer.from(innerCmd, 'utf8').toString('base64');
  const parts = b64.match(/.{1,120}/g) || [];
  await page.evaluate(
    async ({ rootMount, parts }) => {
      await window.weblinuxAdapter.runCommand(`rm -f ${rootMount}/tmp/p15cmd.b64 ${rootMount}/tmp/p15cmd.sh`, 10000);
      for (const part of parts) {
        await window.weblinuxAdapter.runCommand(`printf %s ${part} >> ${rootMount}/tmp/p15cmd.b64`, 10000);
      }
      await window.weblinuxAdapter.runCommand(`base64 -d ${rootMount}/tmp/p15cmd.b64 > ${rootMount}/tmp/p15cmd.sh && chmod +x ${rootMount}/tmp/p15cmd.sh`, 10000);
    },
    { rootMount: cfg.rootMount, parts }
  );
  const res = await page.evaluate(
    async ({ cmd, t }) => {
      return await Promise.race([
        window.weblinuxAdapter.runCommand(cmd, t),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`runCommand hard timeout ${t}ms`)), t + 5000)),
      ]);
    },
    { cmd: `${cfg.chrootCmd} /bin/sh /tmp/p15cmd.sh`, t: timeoutMs }
  );
  return (res.stdout || res.output || '').trim();
}

(async () => {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const result = {
    distroId,
    timestamp: new Date().toISOString(),
    coldBootSec: null,
    warmReloadBootSec: null,
    browserRemovalCheck: '',
    networkCheck: '',
    initialSha256: '',
    persistedSha256: '',
    persistenceCheck: '',
    checks: {},
    screenshots: [],
    status: 'FAILED',
    error: null,
  };

  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: 'msedge',
      headless: false,
      viewport: { width: 1400, height: 900 },
      args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
    });
    const page = ctx.pages()[0] || (await ctx.newPage());
    page.on('pageerror', (err) => console.error('PAGEERROR:', err.message));
    page.on('console', (msg) => {
      const t = msg.text();
      if (msg.type() === 'error' || msg.type() === 'warning' || t.includes('integrity') || t.includes('OPFS') || t.includes('disk') || t.includes('Storage')) {
        console.log('BROWSER_CONSOLE:', msg.type(), t);
      }
    });

    // 1. Boot distribution in Edge (without resetAll() or freshHomeDisk: true)
    console.log(`[${distroId}] 1. Cold booting...`);
    const t0 = Date.now();
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await selectAndLaunch(page);
    result.coldBootSec = Number(((Date.now() - t0) / 1000).toFixed(1));
    console.log(`[${distroId}] Booted in ${result.coldBootSec}s`);

    // 2. Verify Browser Removal
    const browserRemovalScript = `
      echo "=== OS ==="
      grep PRETTY_NAME /etc/os-release || cat /etc/alpine-release
      echo "=== BIN_CHECK ==="
      for b in epiphany chromium firefox badwolf netsurf-gtk falkon; do
        if command -v "$b" >/dev/null 2>&1; then
          echo "FOUND_BIN=$b:$(command -v "$b")"
        fi
      done
      echo "=== PKG_CHECK ==="
      ${cfg.pkgQueryCmd}
      echo "=== WRAPPER_AND_DESKTOP ==="
      [ -e /usr/local/bin/weblinux-browser ] && echo "FOUND_WRAPPER" || echo "NO_WRAPPER_OK"
      [ -e /usr/share/applications/weblinux-browser.desktop ] && echo "FOUND_DESKTOP" || echo "NO_DESKTOP_OK"
    `;
    result.browserRemovalCheck = await runGuest(page, browserRemovalScript, 30000);
    console.log(`[${distroId}] 2. Browser Removal:\n${result.browserRemovalCheck}`);

    // 3. Verify Terminal Internet Access
    const netScript = `
      echo "=== DNS ==="
      getent hosts example.com 2>&1 || true
      echo "=== CURL_HEAD ==="
      curl -sSI --max-time 12 https://example.com 2>&1 | head -n 5 || true
      echo "=== CURL_BODY_SHA256 ==="
      if curl -sL --max-time 12 https://example.com -o /tmp/p15-example.html; then
        sha256sum /tmp/p15-example.html 2>&1
      else
        echo "CURL_BODY_FAIL"
      fi
      echo "=== GIT_LS_REMOTE ==="
      git ls-remote https://github.com/git/git.git HEAD 2>&1 || true
      echo "=== PKG_META ==="
      if ${cfg.pkgMetaCmd} 2>&1; then
        echo "PKG_META_OK"
      else
        echo "PKG_META_FAIL"
      fi
      echo "=== RFC1918 ==="
      curl -s --max-time 4 http://192.168.1.1 >/dev/null 2>&1 && echo "RFC1918_FAIL" || echo "RFC1918_BLOCKED_OK"
    `;
    result.networkCheck = await runGuest(page, netScript, 120000);
    console.log(`[${distroId}] 3. Terminal Internet:\n${result.networkCheck}`);

    // 4. Verify Desktop & OPFS Persistence
    console.log(`[${distroId}] 4. Waiting ${cfg.plasmaWaitMs / 1000}s for Plasma desktop...`);
    await page.waitForTimeout(cfg.plasmaWaitMs);
    const desktopShot = path.join(SCREENSHOT_DIR, `p15-${distroId}-desktop.png`);
    if (await safeScreenshot(page, desktopShot)) result.screenshots.push(desktopShot);

    const marker = `PHASE15_USER_PRESERVE_${distroId}_${Date.now()}`;
    const preserveFile = `${cfg.homeDir}/p15-user-preserve.txt`;
    const writePersistScript = `
      mkdir -p ${cfg.homeDir}
      printf '%s\\n' '${marker}' > ${preserveFile}
      echo "INITIAL_SHA256=$(sha256sum ${preserveFile} | awk '{print $1}')"
      sync
      sync
    `;
    const writeOut = await runGuest(page, writePersistScript, 30000);
    const initMatch = writeOut.match(/INITIAL_SHA256=([a-f0-9]{64})/i);
    result.initialSha256 = initMatch ? initMatch[1].toLowerCase() : '';
    console.log(`[${distroId}] 5. Wrote ${preserveFile} (SHA256=${result.initialSha256})`);

    console.log(`[${distroId}] 6. Shutting down & reloading for OPFS persistence check...`);
    await page.evaluate(async () => {
      if (window.weblinuxAdapter?.shutdown) await window.weblinuxAdapter.shutdown();
    });
    await page.waitForTimeout(2000);

    const t1 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await selectAndLaunch(page);
    result.warmReloadBootSec = Number(((Date.now() - t1) / 1000).toFixed(1));

    const verifyPersistScript = `
      echo "=== PERSIST_CHECK ==="
      ls -la ${preserveFile} 2>&1 || true
      cat ${preserveFile} 2>&1 || true
      echo "PERSISTED_SHA256=$(sha256sum ${preserveFile} 2>/dev/null | awk '{print $1}')"
    `;
    result.persistenceCheck = await runGuest(page, verifyPersistScript, 30000);
    const persMatch = result.persistenceCheck.match(/PERSISTED_SHA256=([a-f0-9]{64})/i);
    result.persistedSha256 = persMatch ? persMatch[1].toLowerCase() : '';
    console.log(`[${distroId}] 7. Persistence (${result.warmReloadBootSec}s reload):\n${result.persistenceCheck}`);

    // Evaluate all checks
    const binSection = extractSection(result.browserRemovalCheck, '=== BIN_CHECK ===', '=== PKG_CHECK ===');
    const pkgSection = extractSection(result.browserRemovalCheck, '=== PKG_CHECK ===', '=== WRAPPER_AND_DESKTOP ===');
    const wrapSection = extractSection(result.browserRemovalCheck, '=== WRAPPER_AND_DESKTOP ===', null);

    const noBrowserBins = !binSection.includes('FOUND_BIN=');
    const noBrowserPkgs = pkgSection.trim() === '';
    const noWrapperOrDesktop =
      wrapSection.includes('NO_WRAPPER_OK') &&
      !wrapSection.includes('FOUND_WRAPPER') &&
      wrapSection.includes('NO_DESKTOP_OK') &&
      !wrapSection.includes('FOUND_DESKTOP');

    const dnsSection = extractSection(result.networkCheck, '=== DNS ===', '=== CURL_HEAD ===');
    const curlHeadSection = extractSection(result.networkCheck, '=== CURL_HEAD ===', '=== CURL_BODY_SHA256 ===');
    const curlShaSection = extractSection(result.networkCheck, '=== CURL_BODY_SHA256 ===', '=== GIT_LS_REMOTE ===');
    const gitSection = extractSection(result.networkCheck, '=== GIT_LS_REMOTE ===', '=== PKG_META ===');
    const pkgMetaSection = extractSection(result.networkCheck, '=== PKG_META ===', '=== RFC1918 ===');
    const rfcSection = extractSection(result.networkCheck, '=== RFC1918 ===', null);

    const hasDns = /\d+\.\d+\.\d+\.\d+|example\.com/i.test(dnsSection) && !/not found|resolve/i.test(dnsSection);
    const hasCurlHead = /HTTP\/(2|1\.1)\s+200/i.test(curlHeadSection);
    const hasCurlSha = /[a-f0-9]{64}\s+\/tmp\/p15-example\.html/i.test(curlShaSection);
    const hasGitLsRemote = /[a-f0-9]{40}\s+HEAD/.test(gitSection);
    const hasPkgMeta = pkgMetaSection.includes('PKG_META_OK') && !pkgMetaSection.includes('PKG_META_FAIL');
    const hasRfc1918Blocked = rfcSection.includes('RFC1918_BLOCKED_OK') && !rfcSection.includes('RFC1918_FAIL');

    const hasDesktopShot = result.screenshots.length > 0;
    const hasPersistMarker = result.persistenceCheck.includes(marker);
    const hasPersistSha = Boolean(result.initialSha256) && result.initialSha256 === result.persistedSha256;

    result.checks = {
      noBrowserBins,
      noBrowserPkgs,
      noWrapperOrDesktop,
      hasDns,
      hasCurlHead,
      hasCurlSha,
      hasGitLsRemote,
      hasPkgMeta,
      hasRfc1918Blocked,
      hasDesktopShot,
      hasPersistMarker,
      hasPersistSha,
    };

    const allPass = Object.values(result.checks).every(Boolean);
    result.status = allPass ? 'PASS' : 'FAILED';
    if (!allPass) {
      process.exitCode = 1;
    }
  } catch (err) {
    result.error = err.message || String(err);
    console.error(`[${distroId}] ERROR:`, result.error);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, `p15-${distroId}-result.json`),
      JSON.stringify(result, null, 2)
    );
    if (ctx) {
      await ctx.close().catch(() => {});
    }
    fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  }
})();
