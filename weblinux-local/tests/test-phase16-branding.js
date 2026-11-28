#!/usr/bin/env node
/**
 * Phase 16 — Native Distribution Branding, Visual QA, Persistence & Regression Test
 * Usage: node tests/test-phase16-branding.js <distroId>
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
    plasmaWaitMs: 95000,
    rebootPlasmaWaitMs: 65000,
    expectedOsPattern: /Debian/i,
  },
  'ubuntu-kde-epiphany': {
    selectorText: 'Ubuntu 24.04.5 LTS KDE',
    chrootCmd: 'ubuntu-kde',
    rootMount: '/ubuntu',
    homeDir: '/root',
    pkgQueryCmd: "dpkg -l epiphany-browser epiphany chromium chromium-browser firefox firefox-esr badwolf netsurf-gtk falkon 2>/dev/null | grep -E '^ii' || true",
    plasmaWaitMs: 95000,
    rebootPlasmaWaitMs: 65000,
    expectedOsPattern: /Ubuntu/i,
  },
  'arch-kde': {
    selectorText: 'Arch Linux RISC-V (Community Port + KDE Plasma 6)',
    chrootCmd: 'arch-root',
    rootMount: '/arch',
    homeDir: '/root',
    pkgQueryCmd: 'pacman -Q epiphany chromium firefox badwolf netsurf falkon 2>/dev/null || true',
    plasmaWaitMs: 110000,
    rebootPlasmaWaitMs: 75000,
    expectedOsPattern: /Arch Linux/i,
  },
  'opensuse-tumbleweed-kde': {
    selectorText: 'openSUSE Tumbleweed RISC-V (KDE Plasma 6)',
    chrootCmd: 'opensuse-root',
    rootMount: '/opensuse',
    homeDir: '/root',
    pkgQueryCmd: "rpm -q epiphany chromium firefox badwolf netsurf falkon 2>/dev/null | grep -v 'is not installed' || true",
    plasmaWaitMs: 145000,
    rebootPlasmaWaitMs: 90000,
    expectedOsPattern: /openSUSE/i,
  },
  'fedora-kde': {
    selectorText: 'Fedora 45 RISC-V (Community Build + KDE Plasma 6)',
    chrootCmd: 'fedora-root',
    rootMount: '/fedora',
    homeDir: '/root',
    pkgQueryCmd: "rpm -q epiphany chromium firefox badwolf netsurf falkon 2>/dev/null | grep -v 'is not installed' || true",
    plasmaWaitMs: 135000,
    rebootPlasmaWaitMs: 85000,
    expectedOsPattern: /Fedora/i,
  },
  'alpine-kde': {
    selectorText: 'Alpine Linux',
    chrootCmd: 'alpine-root',
    rootMount: '/alpine',
    homeDir: '/root',
    pkgQueryCmd: 'apk info -e epiphany chromium firefox badwolf netsurf falkon 2>/dev/null || true',
    plasmaWaitMs: 120000,
    rebootPlasmaWaitMs: 80000,
    expectedOsPattern: /Alpine/i,
  },
};

const distroId = process.argv[2];
if (!distroId || !DISTRO_CONFIGS[distroId]) {
  console.error('Usage: node tests/test-phase16-branding.js <distroId>');
  console.error('Valid distroIds:', Object.keys(DISTRO_CONFIGS).join(', '));
  process.exit(1);
}

const cfg = DISTRO_CONFIGS[distroId];
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'phase16');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const PROFILE_DIR = path.join(__dirname, '..', `.tmp-edge-p16-${distroId}`);

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
  await page.locator('button:has-text("Distributions")').waitFor({ state: 'visible', timeout: 20000 });
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(800);
  const card = page.locator(`div:has-text("${cfg.selectorText}")`).last();
  await card.waitFor({ state: 'visible', timeout: 15000 });
  await card.click();
  await page.waitForTimeout(600);
  const cfgBtn = page.locator('button:has-text("Configure Desktop")');
  await cfgBtn.waitFor({ state: 'visible', timeout: 15000 });
  await cfgBtn.click();
  await page.waitForTimeout(600);
  const launchBtn = page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first();
  await launchBtn.waitFor({ state: 'visible', timeout: 15000 });
  await launchBtn.click();
  return await waitForBoot(page, 180);
}

async function safeScreenshot(page, outPath) {
  console.log(`Capturing screenshot ${path.basename(outPath)}...`);
  try {
    await Promise.race([
      page.screenshot({ path: outPath, timeout: 25000, animations: 'disabled' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot hard timeout 25s')), 27000)),
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
      await window.weblinuxAdapter.runCommand(`rm -f ${rootMount}/tmp/p16cmd.b64 ${rootMount}/tmp/p16cmd.sh`, 10000);
      for (const part of parts) {
        await window.weblinuxAdapter.runCommand(`printf %s ${part} >> ${rootMount}/tmp/p16cmd.b64`, 10000);
      }
      await window.weblinuxAdapter.runCommand(`base64 -d ${rootMount}/tmp/p16cmd.b64 > ${rootMount}/tmp/p16cmd.sh && chmod +x ${rootMount}/tmp/p16cmd.sh`, 10000);
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
    { cmd: `${cfg.chrootCmd} /bin/sh /tmp/p16cmd.sh`, t: timeoutMs }
  );
  return (res.stdout || res.output || '').trim();
}

function buildPlasmaLaunchScript(appInvocation) {
  return `
    PLASMA_PID=$(pidof plasmashell 2>/dev/null | awk '{print $1}')
    if [ -n "$PLASMA_PID" ] && [ -r "/proc/$PLASMA_PID/environ" ]; then
      eval $(tr '\\0' '\\n' < "/proc/$PLASMA_PID/environ" | grep -E '^(XDG_RUNTIME_DIR|WAYLAND_DISPLAY|DBUS_SESSION_BUS_ADDRESS|QT_QPA_PLATFORM|QT_QUICK_BACKEND|QMLSCENE_DEVICE|LIBGL_ALWAYS_SOFTWARE|GALLIUM_DRIVER|VTEST_SOCKET_NAME|EGL_PLATFORM|HOME|USER)=' | sed "s/'/'\\\\\\\\''/g; s/=\\(.*\\)/='\\1'/; s/^/export /")
    fi
    export XDG_RUNTIME_DIR="\${XDG_RUNTIME_DIR:-/tmp/runtime-root}"
    export WAYLAND_DISPLAY="\${WAYLAND_DISPLAY:-wayland-0}"
    export DBUS_SESSION_BUS_ADDRESS="\${DBUS_SESSION_BUS_ADDRESS:-unix:path=\${XDG_RUNTIME_DIR}/bus}"
    export QT_QPA_PLATFORM="\${QT_QPA_PLATFORM:-wayland}"
    ${appInvocation}
  `;
}

(async () => {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const result = {
    phase: '16',
    distroId,
    timestamp: new Date().toISOString(),
    coldBootSec: null,
    warmReloadBootSec: null,
    osReleaseCheck: '',
    brandingConfigCheck: '',
    browserRemovalCheck: '',
    networkCheck: '',
    initialSha256: '',
    persistedSha256: '',
    persistenceCheck: '',
    checks: {},
    screenshots: {},
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
      if (msg.type() === 'error' || t.includes('integrity') || t.includes('OPFS') || t.includes('Storage')) {
        console.log('BROWSER_CONSOLE:', msg.type(), t);
      }
    });

    // 1. Cold boot (never call resetAll() or freshHomeDisk: true)
    console.log(`[${distroId}] 1. Cold booting...`);
    const t0 = Date.now();
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(800);
    await selectAndLaunch(page);
    result.coldBootSec = Number(((Date.now() - t0) / 1000).toFixed(1));
    console.log(`[${distroId}] Booted in ${result.coldBootSec}s`);

    // 2. Wait for Plasma desktop + panel + wallpaper
    console.log(`[${distroId}] 2. Waiting ${cfg.plasmaWaitMs / 1000}s for Plasma desktop...`);
    await page.waitForTimeout(cfg.plasmaWaitMs);

    const desktopShot = path.join(SCREENSHOT_DIR, `p16-${distroId}-01-desktop.png`);
    if (await safeScreenshot(page, desktopShot)) {
      result.screenshots.desktop = path.relative(path.join(__dirname, '..'), desktopShot).replace(/\\/g, '/');
    }

    // 3. Inspect /etc/os-release, KDE branding config & migration marker
    const brandingScript = `
      echo "=== OS_RELEASE ==="
      cat /etc/os-release 2>/dev/null || true
      [ -f /etc/alpine-release ] && echo "ALPINE_RELEASE=$(cat /etc/alpine-release)"
      echo "=== MIGRATION_MARKER ==="
      ls -la "${cfg.homeDir}/.local/state/weblinux/branding-v1-applied" 2>&1 || true
      cat "${cfg.homeDir}/.local/state/weblinux/branding-v1-applied" 2>/dev/null || true
      echo "=== KDEGLOBALS ==="
      cat "${cfg.homeDir}/.config/kdeglobals" 2>/dev/null | head -n 60 || true
      echo "=== PLASMARC ==="
      cat "${cfg.homeDir}/.config/plasmarc" 2>/dev/null | head -n 30 || true
      echo "=== KWINRC ==="
      cat "${cfg.homeDir}/.config/kwinrc" 2>/dev/null | head -n 40 || true
      echo "=== KCMINPUTRC ==="
      cat "${cfg.homeDir}/.config/kcminputrc" 2>/dev/null | head -n 30 || true
      echo "=== WALLPAPER_CONFIG ==="
      grep -niE "Image=|wallpaper|weblinux" "${cfg.homeDir}/.config/plasma-org.kde.plasma.desktop-appletsrc" 2>/dev/null | head -n 20 || true
      echo "=== BRANDING_ASSETS ==="
      ls -la /usr/share/wallpapers/ 2>/dev/null | head -n 20 || true
      find /usr/share/wallpapers /usr/share/pixmaps -maxdepth 3 -iname "*weblinux*" -o -iname "*branding*" 2>/dev/null | head -n 20 || true
    `;
    result.brandingConfigCheck = await runGuest(page, brandingScript, 45000);
    result.osReleaseCheck = extractSection(result.brandingConfigCheck, '=== OS_RELEASE ===', '=== MIGRATION_MARKER ===');
    console.log(`[${distroId}] 3. Branding Config Check:\n${result.brandingConfigCheck}`);

    // 4. Kickoff Launcher screenshot
    console.log(`[${distroId}] 4. Opening Kickoff launcher...`);
    await page.mouse.click(24, 878);
    await page.waitForTimeout(10000);
    const kickoffShot = path.join(SCREENSHOT_DIR, `p16-${distroId}-02-kickoff.png`);
    if (await safeScreenshot(page, kickoffShot)) {
      result.screenshots.kickoff = path.relative(path.join(__dirname, '..'), kickoffShot).replace(/\\/g, '/');
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2500);

    // 5. Konsole screenshot
    console.log(`[${distroId}] 5. Launching Konsole...`);
    await runGuest(
      page,
      buildPlasmaLaunchScript(
        `nohup konsole -e /bin/sh -c "grep PRETTY_NAME /etc/os-release; ls -la ${cfg.homeDir}/.local/state/weblinux/branding-v1-applied; sleep 45" >/tmp/p16-konsole.log 2>&1 </dev/null &`
      ),
      20000
    );
    await page.waitForTimeout(18000);
    const konsoleShot = path.join(SCREENSHOT_DIR, `p16-${distroId}-03-konsole.png`);
    if (await safeScreenshot(page, konsoleShot)) {
      result.screenshots.konsole = path.relative(path.join(__dirname, '..'), konsoleShot).replace(/\\/g, '/');
    }

    // 6. Dolphin screenshot
    console.log(`[${distroId}] 6. Launching Dolphin...`);
    await runGuest(
      page,
      buildPlasmaLaunchScript(`nohup dolphin "${cfg.homeDir}" >/tmp/p16-dolphin.log 2>&1 </dev/null &`),
      20000
    );
    await page.waitForTimeout(18000);
    const dolphinShot = path.join(SCREENSHOT_DIR, `p16-${distroId}-04-dolphin.png`);
    if (await safeScreenshot(page, dolphinShot)) {
      result.screenshots.dolphin = path.relative(path.join(__dirname, '..'), dolphinShot).replace(/\\/g, '/');
    }

    // 7. System Settings screenshot
    console.log(`[${distroId}] 7. Launching System Settings...`);
    await runGuest(
      page,
      buildPlasmaLaunchScript(
        `SYS_BIN=$(command -v systemsettings || command -v systemsettings5 || true); [ -n "$SYS_BIN" ] && nohup "$SYS_BIN" >/tmp/p16-sysettings.log 2>&1 </dev/null &`
      ),
      20000
    );
    await page.waitForTimeout(20000);
    const sysShot = path.join(SCREENSHOT_DIR, `p16-${distroId}-05-systemsettings.png`);
    if (await safeScreenshot(page, sysShot)) {
      result.screenshots.systemSettings = path.relative(path.join(__dirname, '..'), sysShot).replace(/\\/g, '/');
    }

    // 8. Verify no graphical browsers reintroduced
    const browserRemovalScript = `
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
    console.log(`[${distroId}] 8. Browser Removal Check:\n${result.browserRemovalCheck}`);

    // 9. Verify terminal Internet access (DNS + HTTPS curl + RFC1918 block)
    const netScript = `
      echo "=== DNS ==="
      getent hosts example.com 2>&1 || true
      echo "=== CURL_HEAD ==="
      curl -sSI --max-time 12 https://example.com 2>&1 | head -n 5 || true
      echo "=== CURL_BODY_SHA256 ==="
      if curl -sL --max-time 12 https://example.com -o /tmp/p16-example.html; then
        sha256sum /tmp/p16-example.html 2>&1
      else
        echo "CURL_BODY_FAIL"
      fi
      echo "=== RFC1918 ==="
      curl -s --max-time 4 http://192.168.1.1 >/dev/null 2>&1 && echo "RFC1918_FAIL" || echo "RFC1918_BLOCKED_OK"
    `;
    result.networkCheck = await runGuest(page, netScript, 60000);
    console.log(`[${distroId}] 9. Terminal Internet:\n${result.networkCheck}`);

    // 10. Write OPFS persistence marker, shut down, reload & verify rebooted desktop
    const marker = `PHASE16_BRANDING_PERSIST_${distroId}_${Date.now()}`;
    const preserveFile = `${cfg.homeDir}/p16-branding-persist.txt`;
    const writePersistScript = `
      mkdir -p "${cfg.homeDir}"
      printf '%s\\n' '${marker}' > "${preserveFile}"
      echo "INITIAL_SHA256=$(sha256sum "${preserveFile}" | awk '{print $1}')"
      sync
      sync
    `;
    const writeOut = await runGuest(page, writePersistScript, 30000);
    const initMatch = writeOut.match(/INITIAL_SHA256=([a-f0-9]{64})/i);
    result.initialSha256 = initMatch ? initMatch[1].toLowerCase() : '';
    console.log(`[${distroId}] 10. Wrote ${preserveFile} (SHA256=${result.initialSha256})`);

    console.log(`[${distroId}] 11. Shutting down & reloading for OPFS persistence + rebooted desktop...`);
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
      ls -la "${preserveFile}" 2>&1 || true
      cat "${preserveFile}" 2>&1 || true
      echo "PERSISTED_SHA256=$(sha256sum "${preserveFile}" 2>/dev/null | awk '{print $1}')"
      echo "=== REBOOT_BRANDING_MARKER ==="
      ls -la "${cfg.homeDir}/.local/state/weblinux/branding-v1-applied" 2>&1 || true
    `;
    result.persistenceCheck = await runGuest(page, verifyPersistScript, 30000);
    const persMatch = result.persistenceCheck.match(/PERSISTED_SHA256=([a-f0-9]{64})/i);
    result.persistedSha256 = persMatch ? persMatch[1].toLowerCase() : '';
    console.log(`[${distroId}] 12. Persistence (${result.warmReloadBootSec}s reload):\n${result.persistenceCheck}`);

    console.log(`[${distroId}] 13. Waiting ${cfg.rebootPlasmaWaitMs / 1000}s for rebooted Plasma desktop...`);
    await page.waitForTimeout(cfg.rebootPlasmaWaitMs);
    const rebootShot = path.join(SCREENSHOT_DIR, `p16-${distroId}-06-rebooted-desktop.png`);
    if (await safeScreenshot(page, rebootShot)) {
      result.screenshots.rebootedDesktop = path.relative(path.join(__dirname, '..'), rebootShot).replace(/\\/g, '/');
    }

    // Evaluate all checks
    const markerSection = extractSection(result.brandingConfigCheck, '=== MIGRATION_MARKER ===', '=== KDEGLOBALS ===');
    const kdeglobalsSection = extractSection(result.brandingConfigCheck, '=== KDEGLOBALS ===', '=== PLASMARC ===');
    const wallpaperSection = extractSection(result.brandingConfigCheck, '=== WALLPAPER_CONFIG ===', '=== BRANDING_ASSETS ===');
    const rebootMarkerSection = extractSection(result.persistenceCheck, '=== REBOOT_BRANDING_MARKER ===', null);

    const binSection = extractSection(result.browserRemovalCheck, '=== BIN_CHECK ===', '=== PKG_CHECK ===');
    const pkgSection = extractSection(result.browserRemovalCheck, '=== PKG_CHECK ===', '=== WRAPPER_AND_DESKTOP ===');
    const wrapSection = extractSection(result.browserRemovalCheck, '=== WRAPPER_AND_DESKTOP ===', null);

    const dnsSection = extractSection(result.networkCheck, '=== DNS ===', '=== CURL_HEAD ===');
    const curlHeadSection = extractSection(result.networkCheck, '=== CURL_HEAD ===', '=== CURL_BODY_SHA256 ===');
    const curlShaSection = extractSection(result.networkCheck, '=== CURL_BODY_SHA256 ===', '=== RFC1918 ===');
    const rfcSection = extractSection(result.networkCheck, '=== RFC1918 ===', null);

    result.checks = {
      osReleaseMatches: cfg.expectedOsPattern.test(result.osReleaseCheck),
      brandingMarkerPresent: markerSection.includes('branding-v1-applied') && !markerSection.includes('No such file'),
      kdeglobalsConfigured: kdeglobalsSection.trim().length > 0,
      wallpaperConfigured: wallpaperSection.trim().length > 0,
      noBrowserBins: !binSection.includes('FOUND_BIN='),
      noBrowserPkgs: pkgSection.trim() === '',
      noWrapperOrDesktop:
        wrapSection.includes('NO_WRAPPER_OK') &&
        !wrapSection.includes('FOUND_WRAPPER') &&
        wrapSection.includes('NO_DESKTOP_OK') &&
        !wrapSection.includes('FOUND_DESKTOP'),
      hasDns: /\d+\.\d+\.\d+\.\d+|example\.com/i.test(dnsSection) && !/not found|resolve/i.test(dnsSection),
      hasCurlHead: /HTTP\/(2|1\.1)\s+200/i.test(curlHeadSection),
      hasCurlSha: /[a-f0-9]{64}\s+\/tmp\/p16-example\.html/i.test(curlShaSection),
      hasRfc1918Blocked: rfcSection.includes('RFC1918_BLOCKED_OK') && !rfcSection.includes('RFC1918_FAIL'),
      hasPersistMarker: result.persistenceCheck.includes(marker),
      hasPersistSha: Boolean(result.initialSha256) && result.initialSha256 === result.persistedSha256,
      brandingMarkerPersisted: rebootMarkerSection.includes('branding-v1-applied') && !rebootMarkerSection.includes('No such file'),
      hasAllScreenshots: Boolean(
        result.screenshots.desktop &&
        result.screenshots.kickoff &&
        result.screenshots.konsole &&
        result.screenshots.dolphin &&
        result.screenshots.systemSettings &&
        result.screenshots.rebootedDesktop
      ),
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
      path.join(SCREENSHOT_DIR, `p16-${distroId}-result.json`),
      JSON.stringify(result, null, 2)
    );
    if (ctx) {
      await ctx.close().catch(() => {});
    }
    fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  }
})();
