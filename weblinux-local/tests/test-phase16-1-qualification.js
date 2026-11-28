#!/usr/bin/env node
/**
 * Phase 16.1 — Qualification, Visual Evidence & Regression Test Suite
 *
 * Usage:
 *   node tests/test-phase16-1-qualification.js --static
 *   node tests/test-phase16-1-qualification.js <distroId> [--relaunch]
 *
 * Supported distroIds:
 *   debian-firefox (or debian-kde)
 *   ubuntu-kde-epiphany (or ubuntu-kde)
 *   arch-kde
 *   opensuse-tumbleweed-kde
 *   fedora-kde
 *   alpine-kde
 *
 * IMPORTANT: Never calls resetAll() or freshHomeDisk: true.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRANDING_DIR = path.join(REPO_ROOT, 'runtime', 'branding');
const WALLPAPERS_DIR = path.join(BRANDING_DIR, 'wallpapers');
const EVIDENCE_ROOT = 'D:\\weblinux-disks\\phase16-1-release-evidence';
const TEST_REPORTS_DIR = path.join(EVIDENCE_ROOT, 'test-reports');
const NETWORK_REGRESSION_DIR = path.join(EVIDENCE_ROOT, 'network-regression');
const RUNTIME_DIAGNOSTICS_DIR = path.join(EVIDENCE_ROOT, 'runtime-diagnostics');

const CANONICAL_DISTROS = [
  'debian-kde',
  'ubuntu-kde',
  'arch-kde',
  'opensuse-tumbleweed-kde',
  'fedora-kde',
  'alpine-kde',
];

const DISTRO_CONFIGS = {
  'debian-firefox': {
    canonicalId: 'debian-kde',
    evidenceDir: 'debian',
    selectorText: 'Debian GNU/Linux 13 (Trixie)',
    chrootCmd: 'debian',
    rootMount: '/debian',
    homeDir: '/root',
    pkgQueryCmd:
      "dpkg -l epiphany-browser epiphany chromium chromium-browser firefox firefox-esr badwolf netsurf-gtk falkon 2>/dev/null | grep -E '^ii' || true",
    plasmaWaitMs: 95000,
    rebootPlasmaWaitMs: 65000,
    expectedOsPattern: /Debian/i,
    expectedPlasmaMajor: 6,
    testRelaunchByDefault: false,
  },
  'ubuntu-kde-epiphany': {
    canonicalId: 'ubuntu-kde',
    evidenceDir: 'ubuntu',
    selectorText: 'Ubuntu 24.04.5 LTS KDE',
    chrootCmd: 'ubuntu-kde',
    rootMount: '/ubuntu',
    homeDir: '/root',
    pkgQueryCmd:
      "dpkg -l epiphany-browser epiphany chromium chromium-browser firefox firefox-esr badwolf netsurf-gtk falkon 2>/dev/null | grep -E '^ii' || true",
    plasmaWaitMs: 95000,
    rebootPlasmaWaitMs: 65000,
    expectedOsPattern: /Ubuntu/i,
    expectedPlasmaMajor: 5,
    testRelaunchByDefault: true,
  },
  'arch-kde': {
    canonicalId: 'arch-kde',
    evidenceDir: 'arch',
    selectorText: 'Arch Linux RISC-V (Community Port + KDE Plasma 6)',
    chrootCmd: 'arch-root',
    rootMount: '/arch',
    homeDir: '/root',
    pkgQueryCmd: 'pacman -Q epiphany chromium firefox badwolf netsurf falkon 2>/dev/null || true',
    plasmaWaitMs: 110000,
    rebootPlasmaWaitMs: 75000,
    expectedOsPattern: /Arch Linux/i,
    expectedPlasmaMajor: 6,
    testRelaunchByDefault: false,
  },
  'opensuse-tumbleweed-kde': {
    canonicalId: 'opensuse-tumbleweed-kde',
    evidenceDir: 'opensuse',
    selectorText: 'openSUSE Tumbleweed RISC-V (KDE Plasma 6)',
    chrootCmd: 'opensuse-root',
    rootMount: '/opensuse',
    homeDir: '/root',
    pkgQueryCmd:
      "rpm -q epiphany chromium firefox badwolf netsurf falkon 2>/dev/null | grep -v 'is not installed' || true",
    plasmaWaitMs: 145000,
    rebootPlasmaWaitMs: 90000,
    expectedOsPattern: /openSUSE/i,
    expectedPlasmaMajor: 6,
    testRelaunchByDefault: false,
  },
  'fedora-kde': {
    canonicalId: 'fedora-kde',
    evidenceDir: 'fedora',
    selectorText: 'Fedora 45 RISC-V (Community Build + KDE Plasma 6)',
    chrootCmd: 'fedora-root',
    rootMount: '/fedora',
    homeDir: '/root',
    pkgQueryCmd:
      "rpm -q epiphany chromium firefox badwolf netsurf falkon 2>/dev/null | grep -v 'is not installed' || true",
    plasmaWaitMs: 135000,
    rebootPlasmaWaitMs: 85000,
    expectedOsPattern: /Fedora/i,
    expectedPlasmaMajor: 6,
    testRelaunchByDefault: false,
  },
  'alpine-kde': {
    canonicalId: 'alpine-kde',
    evidenceDir: 'alpine',
    selectorText: 'Alpine Linux',
    chrootCmd: 'alpine-root',
    rootMount: '/alpine',
    homeDir: '/root',
    pkgQueryCmd: 'apk info -e epiphany chromium firefox badwolf netsurf falkon 2>/dev/null || true',
    plasmaWaitMs: 120000,
    rebootPlasmaWaitMs: 80000,
    expectedOsPattern: /Alpine/i,
    expectedPlasmaMajor: 6,
    testRelaunchByDefault: false,
  },
};

const CLI_ALIASES = {
  'debian-kde': 'debian-firefox',
  'ubuntu-kde': 'ubuntu-kde-epiphany',
};

function ensureEvidenceDirs() {
  const subdirs = [
    'debian',
    'ubuntu',
    'arch',
    'opensuse',
    'fedora',
    'alpine',
    'runtime-diagnostics',
    'network-regression',
    'test-reports',
  ];
  for (const dir of subdirs) {
    fs.mkdirSync(path.join(EVIDENCE_ROOT, dir), { recursive: true });
  }
}

function readPngDimensions(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(24);
    const bytesRead = fs.readSync(fd, header, 0, 24, 0);
    if (bytesRead < 24) {
      return { valid: false, reason: 'file smaller than 24 bytes' };
    }
    const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!header.subarray(0, 8).equals(pngSig)) {
      return { valid: false, reason: 'invalid PNG signature' };
    }
    const chunkType = header.subarray(12, 16).toString('ascii');
    if (chunkType !== 'IHDR') {
      return { valid: false, reason: `expected IHDR chunk, got ${chunkType}` };
    }
    const width = header.readUInt32BE(16);
    const height = header.readUInt32BE(20);
    return { valid: true, width, height };
  } finally {
    fs.closeSync(fd);
  }
}

function validateSvgFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, reason: 'file missing' };
  }
  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return { valid: false, reason: 'file is empty' };
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const hasOpenSvg = /<svg[\s>]/i.test(content);
  const hasCloseSvg = /<\/svg>/i.test(content);
  if (!hasOpenSvg || !hasCloseSvg) {
    return { valid: false, reason: 'missing <svg> or </svg> tag' };
  }
  return { valid: true, bytes: stat.size };
}

function extractTsBlock(text, marker) {
  const idx = text.indexOf(marker);
  if (idx === -1) return '';
  const openBrace = text.indexOf('{', idx);
  if (openBrace === -1) return '';
  let depth = 0;
  for (let i = openBrace; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(openBrace, i + 1);
      }
    }
  }
  return '';
}

function parseTsAliases(profilesTsText) {
  const block = extractTsBlock(profilesTsText, 'BRANDING_PROFILE_ALIASES');
  const entries = [];
  const duplicates = [];
  const seen = new Set();
  const re = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(block)) !== null) {
    const [, key, target] = match;
    if (seen.has(key)) {
      duplicates.push(key);
    }
    seen.add(key);
    entries.push({ key, target });
  }
  return { entries, duplicates };
}

function parseTsProfileKeys(profilesTsText) {
  const block = extractTsBlock(profilesTsText, 'BRANDING_PROFILES');
  const keys = [];
  const duplicates = [];
  const seen = new Set();
  const re = /^\s{2}['"]([a-z0-9-]+)['"]\s*:\s*\{/gm;
  let match;
  while ((match = re.exec(block)) !== null) {
    const key = match[1];
    if (seen.has(key)) {
      duplicates.push(key);
    }
    seen.add(key);
    keys.push(key);
  }
  return { keys, duplicates };
}

function runStaticValidation() {
  ensureEvidenceDirs();
  const report = {
    phase: '16.1',
    mode: 'static',
    timestamp: new Date().toISOString(),
    checks: {},
    wallpapers: {},
    errors: [],
    status: 'FAILED',
  };

  const registryPath = path.join(WALLPAPERS_DIR, 'registry.json');
  const profilesJsonPath = path.join(BRANDING_DIR, 'profiles.json');
  const profilesTsPath = path.join(BRANDING_DIR, 'profiles.ts');

  if (!fs.existsSync(registryPath)) {
    report.errors.push(`Missing registry.json at ${registryPath}`);
  }
  if (!fs.existsSync(profilesJsonPath)) {
    report.errors.push(`Missing profiles.json at ${profilesJsonPath}`);
  }
  if (!fs.existsSync(profilesTsPath)) {
    report.errors.push(`Missing profiles.ts at ${profilesTsPath}`);
  }

  let registry = null;
  let profilesJson = null;
  let profilesTs = '';

  if (fs.existsSync(registryPath)) {
    try {
      registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    } catch (err) {
      report.errors.push(`Invalid JSON in registry.json: ${err.message}`);
    }
  }
  if (fs.existsSync(profilesJsonPath)) {
    try {
      profilesJson = JSON.parse(fs.readFileSync(profilesJsonPath, 'utf8'));
    } catch (err) {
      report.errors.push(`Invalid JSON in profiles.json: ${err.message}`);
    }
  }
  if (fs.existsSync(profilesTsPath)) {
    profilesTs = fs.readFileSync(profilesTsPath, 'utf8');
  }

  // 1. Validate 6 wallpapers in registry.json and runtime/branding/wallpapers/
  const seenWallpaperIds = new Set();
  const seenSvgFiles = new Set();
  const seenPngFiles = new Set();
  const seenSvgPaths = new Set();
  const seenPngPaths = new Set();
  let allWallpapersValid = Boolean(registry && registry.wallpapers);

  if (registry && registry.wallpapers) {
    const registryKeys = Object.keys(registry.wallpapers);
    const missingCanonicalInRegistry = CANONICAL_DISTROS.filter((id) => !registryKeys.includes(id));
    const extraInRegistry = registryKeys.filter((id) => !CANONICAL_DISTROS.includes(id));
    if (missingCanonicalInRegistry.length > 0) {
      allWallpapersValid = false;
      report.errors.push(`registry.json missing distros: ${missingCanonicalInRegistry.join(', ')}`);
    }
    if (extraInRegistry.length > 0) {
      allWallpapersValid = false;
      report.errors.push(`registry.json has unexpected distros: ${extraInRegistry.join(', ')}`);
    }

    for (const distroId of CANONICAL_DISTROS) {
      const entry = registry.wallpapers[distroId];
      if (!entry) continue;

      const svgFile = path.join(WALLPAPERS_DIR, entry.svgFilename || '');
      const pngFile = path.join(WALLPAPERS_DIR, entry.pngFilename || '');
      const svgCheck = validateSvgFile(svgFile);
      const pngCheck = fs.existsSync(pngFile)
        ? readPngDimensions(pngFile)
        : { valid: false, reason: 'file missing' };
      const pngDimOk = pngCheck.valid && pngCheck.width === 1920 && pngCheck.height === 1080;

      if (!svgCheck.valid) {
        allWallpapersValid = false;
        report.errors.push(`[${distroId}] SVG invalid (${svgFile}): ${svgCheck.reason}`);
      }
      if (!pngDimOk) {
        allWallpapersValid = false;
        const detail = pngCheck.valid
          ? `dimensions ${pngCheck.width}x${pngCheck.height} != 1920x1080`
          : pngCheck.reason;
        report.errors.push(`[${distroId}] PNG invalid (${pngFile}): ${detail}`);
      }

      if (seenWallpaperIds.has(entry.wallpaperId)) {
        allWallpapersValid = false;
        report.errors.push(`Duplicate wallpaperId: ${entry.wallpaperId}`);
      }
      if (seenSvgFiles.has(entry.svgFilename)) {
        allWallpapersValid = false;
        report.errors.push(`Duplicate svgFilename: ${entry.svgFilename}`);
      }
      if (seenPngFiles.has(entry.pngFilename)) {
        allWallpapersValid = false;
        report.errors.push(`Duplicate pngFilename: ${entry.pngFilename}`);
      }
      if (seenSvgPaths.has(entry.svgPath)) {
        allWallpapersValid = false;
        report.errors.push(`Duplicate svgPath: ${entry.svgPath}`);
      }
      if (seenPngPaths.has(entry.pngPath)) {
        allWallpapersValid = false;
        report.errors.push(`Duplicate pngPath: ${entry.pngPath}`);
      }

      seenWallpaperIds.add(entry.wallpaperId);
      seenSvgFiles.add(entry.svgFilename);
      seenPngFiles.add(entry.pngFilename);
      seenSvgPaths.add(entry.svgPath);
      seenPngPaths.add(entry.pngPath);

      report.wallpapers[distroId] = {
        wallpaperId: entry.wallpaperId,
        svgFilename: entry.svgFilename,
        pngFilename: entry.pngFilename,
        svgValid: svgCheck.valid,
        pngValid1920x1080: pngDimOk,
        pngDimensions: pngCheck.valid ? `${pngCheck.width}x${pngCheck.height}` : null,
      };
    }
  }
  report.checks.allSixWallpapersExistAndValid = allWallpapersValid;

  // 2. Validate profiles.json mappings & Plasma 5 vs Plasma 6 preservation
  let profilesJsonValid = Boolean(profilesJson && profilesJson.profiles && profilesJson.aliases);
  if (profilesJson && profilesJson.profiles && profilesJson.aliases) {
    const profileKeys = Object.keys(profilesJson.profiles);
    const missingProfiles = CANONICAL_DISTROS.filter((id) => !profileKeys.includes(id));
    const extraProfiles = profileKeys.filter((id) => !CANONICAL_DISTROS.includes(id));
    if (missingProfiles.length > 0) {
      profilesJsonValid = false;
      report.errors.push(`profiles.json missing profiles: ${missingProfiles.join(', ')}`);
    }
    if (extraProfiles.length > 0) {
      profilesJsonValid = false;
      report.errors.push(`profiles.json has unexpected profiles: ${extraProfiles.join(', ')}`);
    }

    for (const [alias, target] of Object.entries(profilesJson.aliases)) {
      if (!profilesJson.profiles[target]) {
        profilesJsonValid = false;
        report.errors.push(`profiles.json alias '${alias}' points to unknown target '${target}'`);
      }
    }
    for (const id of CANONICAL_DISTROS) {
      if (profilesJson.aliases[id] !== id) {
        profilesJsonValid = false;
        report.errors.push(`profiles.json canonical alias '${id}' must map to '${id}'`);
      }
      const p = profilesJson.profiles[id];
      if (!p) continue;
      if (p.id !== id) {
        profilesJsonValid = false;
        report.errors.push(`profiles.json profile '${id}' has mismatched id '${p.id}'`);
      }
      const expectedMajor = id === 'ubuntu-kde' ? 5 : 6;
      const expectedTool = id === 'ubuntu-kde' ? 'kwriteconfig5' : 'kwriteconfig6';
      if (p.plasmaMajor !== expectedMajor || p.kwriteconfigTool !== expectedTool) {
        profilesJsonValid = false;
        report.errors.push(
          `profiles.json '${id}' Plasma tooling mismatch: got plasmaMajor=${p.plasmaMajor}, tool=${p.kwriteconfigTool}`
        );
      }
      if (!p.wallpaperPath || !String(p.wallpaperPath).startsWith('/usr/share/wallpapers/WebLinux-')) {
        profilesJsonValid = false;
        report.errors.push(`profiles.json '${id}' invalid wallpaperPath: ${p.wallpaperPath}`);
      }
    }
  }
  report.checks.profilesJsonMappingValid = profilesJsonValid;

  // 3. Validate profiles.ts mappings & consistency with profiles.json
  let profilesTsValid = Boolean(profilesTs);
  if (profilesTs) {
    const tsAliases = parseTsAliases(profilesTs);
    const tsProfiles = parseTsProfileKeys(profilesTs);

    if (tsAliases.duplicates.length > 0) {
      profilesTsValid = false;
      report.errors.push(`profiles.ts duplicate alias keys: ${tsAliases.duplicates.join(', ')}`);
    }
    if (tsProfiles.duplicates.length > 0) {
      profilesTsValid = false;
      report.errors.push(`profiles.ts duplicate profile keys: ${tsProfiles.duplicates.join(', ')}`);
    }

    const missingTsProfiles = CANONICAL_DISTROS.filter((id) => !tsProfiles.keys.includes(id));
    const extraTsProfiles = tsProfiles.keys.filter((id) => !CANONICAL_DISTROS.includes(id));
    if (missingTsProfiles.length > 0) {
      profilesTsValid = false;
      report.errors.push(`profiles.ts missing profiles: ${missingTsProfiles.join(', ')}`);
    }
    if (extraTsProfiles.length > 0) {
      profilesTsValid = false;
      report.errors.push(`profiles.ts unexpected profiles: ${extraTsProfiles.join(', ')}`);
    }

    const tsAliasMap = Object.fromEntries(tsAliases.entries.map((e) => [e.key, e.target]));
    for (const [alias, target] of Object.entries(tsAliasMap)) {
      if (!CANONICAL_DISTROS.includes(target)) {
        profilesTsValid = false;
        report.errors.push(`profiles.ts alias '${alias}' points to invalid target '${target}'`);
      }
    }
    if (profilesJson && profilesJson.aliases) {
      for (const [alias, target] of Object.entries(profilesJson.aliases)) {
        if (tsAliasMap[alias] !== target) {
          profilesTsValid = false;
          report.errors.push(
            `Alias mismatch between profiles.json and profiles.ts for '${alias}': json='${target}' vs ts='${tsAliasMap[alias]}'`
          );
        }
      }
      for (const [alias, target] of Object.entries(tsAliasMap)) {
        if (profilesJson.aliases[alias] !== target) {
          profilesTsValid = false;
          report.errors.push(
            `Extra/mismatched alias in profiles.ts '${alias}' -> '${target}' not matching profiles.json`
          );
        }
      }
    }
  }
  report.checks.profilesTsMappingValid = profilesTsValid;

  const allPass = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  report.status = allPass ? 'PASS' : 'FAILED';

  const reportOut = path.join(TEST_REPORTS_DIR, 'static-validation.json');
  fs.writeFileSync(reportOut, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
  console.log(`Static validation report written to: ${reportOut}`);
  process.exitCode = allPass ? 0 : 1;
}

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

async function selectAndLaunch(page, cfg) {
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
  const launchBtn = page
    .locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")')
    .first();
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
    console.log(`Saved ${outPath}`);
    return outPath;
  } catch (err) {
    console.warn(`Screenshot failed for ${path.basename(outPath)}: ${err.message}`);
    return null;
  }
}

async function runGuest(page, cfg, innerCmd, timeoutMs = 45000) {
  const b64 = Buffer.from(innerCmd, 'utf8').toString('base64');
  const parts = b64.match(/.{1,120}/g) || [];
  await page.evaluate(
    async ({ rootMount, parts }) => {
      await window.weblinuxAdapter.runCommand(
        `rm -f ${rootMount}/tmp/p161cmd.b64 ${rootMount}/tmp/p161cmd.sh`,
        10000
      );
      for (const part of parts) {
        await window.weblinuxAdapter.runCommand(`printf %s ${part} >> ${rootMount}/tmp/p161cmd.b64`, 10000);
      }
      await window.weblinuxAdapter.runCommand(
        `base64 -d ${rootMount}/tmp/p161cmd.b64 > ${rootMount}/tmp/p161cmd.sh && chmod +x ${rootMount}/tmp/p161cmd.sh`,
        10000
      );
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
    { cmd: `${cfg.chrootCmd} /bin/sh /tmp/p161cmd.sh`, t: timeoutMs }
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

function loadDesktopReadinessHelper() {
  const helperPath = path.join(__dirname, 'helpers', 'desktop-readiness.js');
  if (!fs.existsSync(helperPath)) {
    return null;
  }
  try {
    return require(helperPath);
  } catch (err) {
    console.warn(`Could not load desktop-readiness helper (${helperPath}): ${err.message}`);
    return null;
  }
}

async function waitForCompositorAndDesktopReady(page, distroId, cfg, maxWaitMs) {
  const helper = loadDesktopReadinessHelper();
  if (helper) {
    const fn =
      (typeof helper === 'function' && helper) ||
      helper.waitForDesktopReady ||
      helper.waitForCompositorReady ||
      helper.waitForPlasmaReady;
    if (typeof fn === 'function') {
      console.log(`[${distroId}] Using tests/helpers/desktop-readiness.js for compositor readiness...`);
      return await fn(page, {
        distroId,
        chrootCmd: cfg.chrootCmd,
        rootMount: cfg.rootMount,
        timeoutMs: maxWaitMs,
        runGuest: (_p, cmd, t) => runGuest(page, cfg, cmd, t),
      });
    }
  }

  console.log(`[${distroId}] Waiting for compositor + Plasma readiness (fallback, up to ${maxWaitMs / 1000}s)...`);
  const deadline = Date.now() + maxWaitMs;
  let lastState = { waylandActive: false, hasPlasma: false, hasCanvas: false };

  while (Date.now() < deadline) {
    const uiState = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : null;
      return {
        waylandActive: Boolean(window.weblinuxAdapter?.status?.waylandActive),
        hasCanvas: Boolean(canvas && rect && rect.width > 100 && rect.height > 100),
      };
    });

    let hasPlasma = false;
    try {
      const psOut = await runGuest(page, cfg, 'pidof plasmashell 2>/dev/null || true', 10000);
      hasPlasma = /\d+/.test(psOut);
    } catch {
      hasPlasma = false;
    }

    lastState = { ...uiState, hasPlasma };
    if (uiState.waylandActive && uiState.hasCanvas && hasPlasma) {
      // Allow compositor frame flush & panel/wallpaper paint stabilization
      await page.waitForTimeout(8000);
      return { ready: true, via: 'fallback', ...lastState };
    }
    await page.waitForTimeout(3000);
  }

  return { ready: false, via: 'fallback', ...lastState };
}

async function runLiveQualification(rawDistroId, forceRelaunch) {
  ensureEvidenceDirs();
  const distroId = CLI_ALIASES[rawDistroId] || rawDistroId;
  const cfg = DISTRO_CONFIGS[distroId];
  if (!cfg) {
    console.error('Unknown distroId:', rawDistroId);
    console.error('Valid distroIds:', [...Object.keys(DISTRO_CONFIGS), ...Object.keys(CLI_ALIASES)].join(', '));
    process.exit(1);
  }

  const shouldTestRelaunch = forceRelaunch || cfg.testRelaunchByDefault;
  const evidenceDir = path.join(EVIDENCE_ROOT, cfg.evidenceDir);
  const PROFILE_DIR = path.join(REPO_ROOT, `.tmp-edge-p161-${distroId}`);
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const result = {
    phase: '16.1',
    mode: 'live',
    distroId,
    canonicalId: cfg.canonicalId,
    timestamp: new Date().toISOString(),
    coldBootSec: null,
    warmReloadBootSec: null,
    relaunchBootSec: null,
    compositorReadiness: null,
    osReleaseCheck: '',
    brandingConfigCheck: '',
    browserRemovalCheck: '',
    networkCheck: '',
    initialSha256: '',
    persistedSha256: '',
    relaunchSha256: '',
    persistenceCheck: '',
    relaunchCheck: '',
    checks: {},
    screenshots: {},
    status: 'FAILED',
    error: null,
  };

  let ctx;
  const consoleErrors = [];
  try {
    ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: 'msedge',
      headless: false,
      viewport: { width: 1400, height: 900 },
      args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
    });
    let page = ctx.pages()[0] || (await ctx.newPage());
    page.on('pageerror', (err) => consoleErrors.push(`PAGEERROR: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`CONSOLE_ERROR: ${msg.text()}`);
      }
    });

    // 1. Cold boot (never call resetAll() or freshHomeDisk: true)
    console.log(`[${distroId}] 1. Cold booting...`);
    const t0 = Date.now();
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(800);
    await selectAndLaunch(page, cfg);
    result.coldBootSec = Number(((Date.now() - t0) / 1000).toFixed(1));
    console.log(`[${distroId}] Booted in ${result.coldBootSec}s`);

    // 2. Wait for real compositor frame & Plasma readiness
    result.compositorReadiness = await waitForCompositorAndDesktopReady(page, distroId, cfg, Math.max(cfg.plasmaWaitMs, 150000));
    await runGuest(
      page,
      cfg,
      buildPlasmaLaunchScript(`[ -x /usr/local/bin/weblinux-apply-kde-branding ] && HOME="${cfg.homeDir}" /usr/local/bin/weblinux-apply-kde-branding --profile "${cfg.canonicalId}" || true`),
      25000
    );
    await page.waitForTimeout(3000);
    const desktopShot = path.join(evidenceDir, '01-desktop.png');
    if (await safeScreenshot(page, desktopShot)) {
      result.screenshots.desktop = desktopShot;
    }

    // 3. Inspect /etc/os-release, v2 logo wallpaper marker & KDE branding config
    const brandingScript = `
      echo "=== OS_RELEASE ==="
      cat /etc/os-release 2>/dev/null || true
      [ -f /etc/alpine-release ] && echo "ALPINE_RELEASE=$(cat /etc/alpine-release)"
      echo "=== MIGRATION_V2_MARKER ==="
      ls -la "${cfg.homeDir}/.local/state/weblinux/branding-v2-logo-wallpaper-applied" 2>&1 || true
      cat "${cfg.homeDir}/.local/state/weblinux/branding-v2-logo-wallpaper-applied" 2>/dev/null || true
      echo "=== MIGRATION_V1_MARKER ==="
      ls -la "${cfg.homeDir}/.local/state/weblinux/branding-v1-applied" 2>&1 || true
      echo "=== WALLPAPER_CONFIG ==="
      grep -niE "Image=|wallpaper|weblinux" "${cfg.homeDir}/.config/plasma-org.kde.plasma.desktop-appletsrc" 2>/dev/null | head -n 25 || true
      echo "=== BRANDING_ASSETS ==="
      find /usr/share/wallpapers -maxdepth 4 -iname "*logo-wallpaper*" 2>/dev/null | head -n 20 || true
    `;
    result.brandingConfigCheck = await runGuest(page, cfg, brandingScript, 45000);
    result.osReleaseCheck = extractSection(
      result.brandingConfigCheck,
      '=== OS_RELEASE ===',
      '=== MIGRATION_V2_MARKER ==='
    );

    // 4. Dolphin screenshot
    console.log(`[${distroId}] 4. Launching Dolphin...`);
    await runGuest(
      page,
      cfg,
      buildPlasmaLaunchScript(`nohup dolphin "${cfg.homeDir}" >/tmp/p161-dolphin.log 2>&1 </dev/null &`),
      20000
    );
    await page.waitForTimeout(18000);
    const dolphinShot = path.join(evidenceDir, '02-dolphin.png');
    if (await safeScreenshot(page, dolphinShot)) {
      result.screenshots.dolphin = dolphinShot;
    }

    // 5. Konsole screenshot
    console.log(`[${distroId}] 5. Launching Konsole...`);
    await runGuest(
      page,
      cfg,
      buildPlasmaLaunchScript(
        `nohup konsole -e /bin/sh -c "grep PRETTY_NAME /etc/os-release; ls -la ${cfg.homeDir}/.local/state/weblinux/branding-v2-logo-wallpaper-applied; sleep 45" >/tmp/p161-konsole.log 2>&1 </dev/null &`
      ),
      20000
    );
    await page.waitForTimeout(18000);
    const konsoleShot = path.join(evidenceDir, '03-konsole.png');
    if (await safeScreenshot(page, konsoleShot)) {
      result.screenshots.konsole = konsoleShot;
    }

    // 6. Verify browser-free state
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
    result.browserRemovalCheck = await runGuest(page, cfg, browserRemovalScript, 30000);

    // 7. Verify terminal Internet access (DNS + HTTPS curl + RFC1918 block)
    const netScript = `
      echo "=== DNS ==="
      getent hosts example.com 2>&1 || true
      echo "=== CURL_HEAD ==="
      curl -sSI --max-time 12 https://example.com 2>&1 | head -n 5 || true
      echo "=== CURL_BODY_SHA256 ==="
      if curl -sL --max-time 12 https://example.com -o /tmp/p161-example.html; then
        sha256sum /tmp/p161-example.html 2>&1
      else
        echo "CURL_BODY_FAIL"
      fi
      echo "=== RFC1918 ==="
      curl -s --max-time 4 http://192.168.1.1 >/dev/null 2>&1 && echo "RFC1918_FAIL" || echo "RFC1918_BLOCKED_OK"
    `;
    result.networkCheck = await runGuest(page, cfg, netScript, 60000);

    // 8. Write OPFS persistence marker, shut down, warm reload & verify rebooted desktop
    const marker = `PHASE16_1_PERSIST_${distroId}_${Date.now()}`;
    const preserveFile = `${cfg.homeDir}/p16-1-persist.txt`;
    const writeOut = await runGuest(
      page,
      cfg,
      `
        mkdir -p "${cfg.homeDir}"
        printf '%s\\n' '${marker}' > "${preserveFile}"
        echo "INITIAL_SHA256=$(sha256sum "${preserveFile}" | awk '{print $1}')"
        sync
        sync
      `,
      30000
    );
    const initMatch = writeOut.match(/INITIAL_SHA256=([a-f0-9]{64})/i);
    result.initialSha256 = initMatch ? initMatch[1].toLowerCase() : '';

    console.log(`[${distroId}] 8. Shutting down & reloading for OPFS persistence + warm reboot...`);
    await page.evaluate(async () => {
      if (window.weblinuxAdapter?.shutdown) await window.weblinuxAdapter.shutdown();
    });
    await page.waitForTimeout(2000);

    const t1 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await selectAndLaunch(page, cfg);
    result.warmReloadBootSec = Number(((Date.now() - t1) / 1000).toFixed(1));

    result.persistenceCheck = await runGuest(
      page,
      cfg,
      `
        echo "=== PERSIST_CHECK ==="
        ls -la "${preserveFile}" 2>&1 || true
        cat "${preserveFile}" 2>&1 || true
        echo "PERSISTED_SHA256=$(sha256sum "${preserveFile}" 2>/dev/null | awk '{print $1}')"
        echo "=== REBOOT_BRANDING_V2_MARKER ==="
        ls -la "${cfg.homeDir}/.local/state/weblinux/branding-v2-logo-wallpaper-applied" 2>&1 || true
      `,
      30000
    );
    const persMatch = result.persistenceCheck.match(/PERSISTED_SHA256=([a-f0-9]{64})/i);
    result.persistedSha256 = persMatch ? persMatch[1].toLowerCase() : '';

    await waitForCompositorAndDesktopReady(page, distroId, cfg, cfg.rebootPlasmaWaitMs);
    const rebootShot = path.join(evidenceDir, '04-post-reboot.png');
    if (await safeScreenshot(page, rebootShot)) {
      result.screenshots.postReboot = rebootShot;
    }

    // 9. Relaunch after termination (Ubuntu/lifecycle testing)
    if (shouldTestRelaunch) {
      console.log(`[${distroId}] 9. Testing relaunch after browser/runtime termination (preserving OPFS)...`);
      await page.evaluate(async () => {
        if (window.weblinuxAdapter?.shutdown) await window.weblinuxAdapter.shutdown();
      });
      await page.waitForTimeout(1500);
      await ctx.close();
      ctx = null;

      ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
        channel: 'msedge',
        headless: false,
        viewport: { width: 1400, height: 900 },
        args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
      });
      page = ctx.pages()[0] || (await ctx.newPage());

      const t2 = Date.now();
      await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(800);
      await selectAndLaunch(page, cfg);
      result.relaunchBootSec = Number(((Date.now() - t2) / 1000).toFixed(1));

      result.relaunchCheck = await runGuest(
        page,
        cfg,
        `
          echo "=== RELAUNCH_PERSIST ==="
          cat "${preserveFile}" 2>&1 || true
          echo "RELAUNCH_SHA256=$(sha256sum "${preserveFile}" 2>/dev/null | awk '{print $1}')"
          echo "=== RELAUNCH_BRANDING_V2_MARKER ==="
          ls -la "${cfg.homeDir}/.local/state/weblinux/branding-v2-logo-wallpaper-applied" 2>&1 || true
        `,
        30000
      );
      const relaunchMatch = result.relaunchCheck.match(/RELAUNCH_SHA256=([a-f0-9]{64})/i);
      result.relaunchSha256 = relaunchMatch ? relaunchMatch[1].toLowerCase() : '';

      await waitForCompositorAndDesktopReady(page, distroId, cfg, cfg.rebootPlasmaWaitMs);
      const relaunchShot = path.join(evidenceDir, '05-post-relaunch.png');
      if (await safeScreenshot(page, relaunchShot)) {
        result.screenshots.postRelaunch = relaunchShot;
      }
    }

    // Evaluate checks
    const v2MarkerSection = extractSection(
      result.brandingConfigCheck,
      '=== MIGRATION_V2_MARKER ===',
      '=== MIGRATION_V1_MARKER ==='
    );
    const wallpaperSection = extractSection(
      result.brandingConfigCheck,
      '=== WALLPAPER_CONFIG ===',
      '=== BRANDING_ASSETS ==='
    );
    const rebootV2Section = extractSection(
      result.persistenceCheck,
      '=== REBOOT_BRANDING_V2_MARKER ===',
      null
    );

    const binSection = extractSection(result.browserRemovalCheck, '=== BIN_CHECK ===', '=== PKG_CHECK ===');
    const pkgSection = extractSection(
      result.browserRemovalCheck,
      '=== PKG_CHECK ===',
      '=== WRAPPER_AND_DESKTOP ==='
    );
    const wrapSection = extractSection(result.browserRemovalCheck, '=== WRAPPER_AND_DESKTOP ===', null);

    const dnsSection = extractSection(result.networkCheck, '=== DNS ===', '=== CURL_HEAD ===');
    const curlHeadSection = extractSection(result.networkCheck, '=== CURL_HEAD ===', '=== CURL_BODY_SHA256 ===');
    const curlShaSection = extractSection(result.networkCheck, '=== CURL_BODY_SHA256 ===', '=== RFC1918 ===');
    const rfcSection = extractSection(result.networkCheck, '=== RFC1918 ===', null);

    result.checks = {
      osReleaseMatches: cfg.expectedOsPattern.test(result.osReleaseCheck),
      compositorReady: Boolean(result.compositorReadiness?.ready),
      brandingV2MarkerPresent:
        v2MarkerSection.includes('branding-v2-logo-wallpaper-applied') &&
        !v2MarkerSection.includes('No such file'),
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
      hasCurlSha: /[a-f0-9]{64}\s+\/tmp\/p161-example\.html/i.test(curlShaSection),
      hasRfc1918Blocked: rfcSection.includes('RFC1918_BLOCKED_OK') && !rfcSection.includes('RFC1918_FAIL'),
      hasPersistMarker: result.persistenceCheck.includes(marker),
      hasPersistSha: Boolean(result.initialSha256) && result.initialSha256 === result.persistedSha256,
      brandingV2MarkerPersisted:
        rebootV2Section.includes('branding-v2-logo-wallpaper-applied') &&
        !rebootV2Section.includes('No such file'),
      hasAllRequiredScreenshots: Boolean(
        result.screenshots.desktop &&
          result.screenshots.dolphin &&
          result.screenshots.konsole &&
          result.screenshots.postReboot
      ),
    };

    if (shouldTestRelaunch) {
      result.checks.relaunchPersistSha =
        Boolean(result.initialSha256) && result.initialSha256 === result.relaunchSha256;
      result.checks.relaunchBrandingV2Marker =
        result.relaunchCheck.includes('branding-v2-logo-wallpaper-applied') &&
        !result.relaunchCheck.includes('No such file');
    }

    const allPass = Object.values(result.checks).every(Boolean);
    result.status = allPass ? 'PASS' : 'FAILED';
    if (!allPass) {
      process.exitCode = 1;
    }

    // Write network regression evidence
    fs.writeFileSync(
      path.join(NETWORK_REGRESSION_DIR, `${cfg.evidenceDir}-network.json`),
      JSON.stringify(
        {
          distroId,
          timestamp: new Date().toISOString(),
          hasDns: result.checks.hasDns,
          hasCurlHead: result.checks.hasCurlHead,
          hasCurlSha: result.checks.hasCurlSha,
          hasRfc1918Blocked: result.checks.hasRfc1918Blocked,
          rawOutput: result.networkCheck,
        },
        null,
        2
      )
    );
  } catch (err) {
    result.error = err.message || String(err);
    console.error(`[${distroId}] ERROR:`, result.error);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(
      path.join(TEST_REPORTS_DIR, `${cfg.evidenceDir}-qualification.json`),
      JSON.stringify(result, null, 2)
    );
    fs.writeFileSync(
      path.join(RUNTIME_DIAGNOSTICS_DIR, `${cfg.evidenceDir}-diagnostics.json`),
      JSON.stringify(
        {
          distroId,
          timestamp: result.timestamp,
          coldBootSec: result.coldBootSec,
          warmReloadBootSec: result.warmReloadBootSec,
          relaunchBootSec: result.relaunchBootSec,
          compositorReadiness: result.compositorReadiness,
          consoleErrors,
          error: result.error,
        },
        null,
        2
      )
    );
    if (ctx) {
      await ctx.close().catch(() => {});
    }
    fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
if (args.includes('--static')) {
  runStaticValidation();
} else if (args.length >= 1 && !args[0].startsWith('-')) {
  const forceRelaunch = args.includes('--relaunch');
  runLiveQualification(args[0], forceRelaunch);
} else {
  console.error('Usage:');
  console.error('  node tests/test-phase16-1-qualification.js --static');
  console.error('  node tests/test-phase16-1-qualification.js <distroId> [--relaunch]');
  process.exit(1);
}
