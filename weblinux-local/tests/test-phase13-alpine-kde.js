#!/usr/bin/env node
/**
 * Phase 13.10 & 13.11 — Live Microsoft Edge Qualification for Alpine Linux 3.24.4 KDE
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = path.join(__dirname, 'screenshots', 'phase13');
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
const PROFILE_DIR = path.join(__dirname, '..', '.tmp-edge-p13-profile');

async function waitForBoot(page, timeoutSec = 120) {
  for (let i = 0; i < timeoutSec; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
      waylandActive: window.weblinuxAdapter?.status?.waylandActive,
      error: window.weblinuxAdapter?.status?.error,
    }));
    if (st.error) {
      const logs = await page.evaluate(async () => {
        return await window.weblinuxAdapter.runCommand('mount; ls -la /alpine /alpine/usr/bin/plasmashell 2>&1; cat /alpine/tmp/kwin.log /alpine/tmp/rvgpu.log /alpine/tmp/dbus.log /alpine/root/alpine-kde-session.log 2>&1', 10000);
      });
      throw new Error('Boot error: ' + st.error + '\nDIAG:\n' + (logs.stdout || logs.output || ''));
    }
    if (st.state === 'running' && st.shellReady) return st;
  }
  throw new Error('Timed out waiting for guest shellReady');
}

async function launchAlpine(page, captureSelector = false) {
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(500);
  await page.locator('div:has-text("Alpine Linux")').last().click();
  await page.waitForTimeout(400);
  if (captureSelector) {
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p13-01-alpine-selector.png') });
  }
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(600);
  const btns = await page.locator('button').allInnerTexts();
  console.log('Buttons on DesktopSelector:', btns);
  await page.locator('button:has-text("Launch")').first().click();
  return await waitForBoot(page, 120);
}

(async () => {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1400, height: 900 },
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  page.on('pageerror', (err) => console.error('PAGEERROR:', err));

  const t0 = Date.now();
  console.log('1. Selecting Alpine Linux 3.24.4 RISC-V...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const st = await launchAlpine(page, true);
  const coldBootSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`2. Cold booted in ${coldBootSec}s:`, st);

  // Verify Alpine identity, musl, APK, mounts, networking, RFC1918 block, and session logs
  const sysInfo = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      `mount | grep wd; dmesg | grep -iE "wd|ext4" | tail -n 6; alpine-root '
        echo "=== IDENTITY ==="; uname -a; cat /etc/alpine-release; grep PRETTY_NAME /etc/os-release;
        echo "=== MUSL ==="; ldd --version 2>&1 | head -n 2;
        echo "=== APK ==="; apk --version; apk --print-arch; apk info | wc -l; apk policy alpine-keys; apk update; apk audit || true;
        echo "=== NET ==="; getent hosts example.com; curl -sI --max-time 10 https://example.com | head -n 2;
        curl -s --max-time 4 http://192.168.1.1 >/dev/null 2>&1 && echo "RFC1918_FAIL" || echo "RFC1918_BLOCKED_OK";
        cat /root/alpine-kde-session.log
      '`,
      120000
    );
  });
  const sysOut = sysInfo.stdout || sysInfo.output || '';
  console.log('3. Alpine Info, APK & Network:\n' + sysOut.trim());
  if (!sysOut.includes('3.24.4') || !sysOut.includes('musl') || !sysOut.includes('apk-tools 3.0.9') || !sysOut.includes('RFC1918_BLOCKED_OK')) {
    throw new Error('Alpine identity/APK/network verification failed');
  }

  // Wait for Plasma 6.6.6 desktop + panel to render
  console.log('4. Waiting 135s for Plasma 6.6.6 desktop & panel...');
  await page.waitForTimeout(135000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p13-02-alpine-kde-desktop.png'), timeout: 60000 });

  // Click Kickoff launcher
  await page.mouse.click(24, 878);
  await page.waitForTimeout(12000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p13-03-alpine-launcher.png'), timeout: 60000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);

  // Launch Konsole (showing Alpine identity, musl, and apk)
  await page.evaluate(async () => {
    await window.weblinuxAdapter.runCommand(
      `alpine-root 'nohup konsole -e /bin/sh -c "cat /etc/os-release; ldd --version 2>&1 | head -n 2; apk --version; apk info | wc -l; sleep 45" >/tmp/konsole.log 2>&1 </dev/null &'`,
      15000
    );
  });
  await page.waitForTimeout(22000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p13-04-alpine-konsole.png'), timeout: 60000 });

  // Launch Dolphin
  await page.evaluate(async () => {
    await window.weblinuxAdapter.runCommand(
      `alpine-root 'nohup dolphin /root >/tmp/dolphin.log 2>&1 </dev/null &'`,
      15000
    );
  });
  await page.waitForTimeout(25000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p13-05-alpine-dolphin.png'), timeout: 60000 });

  // Window drag
  await page.mouse.move(300, 152);
  await page.mouse.down();
  await page.mouse.move(480, 210, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p13-06-alpine-window-ops.png'), timeout: 60000 });

  // APK signature enforcement & package install test + persistence payload + memory stats
  const apkRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(`alpine-root 'apk add --no-cache tree && tree --version'`, 180000);
  });
  console.log('5a. APK Install (tree):\n' + (apkRes.stdout || apkRes.output || '').trim());

  const testId = `P13_ALPINE_PERSIST_${Date.now()}`;
  const midRes = await page.evaluate(async (id) => {
    const cmd = `alpine-root '
      python3 -c "import hashlib,time; hdr=b\\"${id}\\\\nTS=\\" + str(time.time()).encode() + b\\"\\\\n\\"; data=hdr + b\\"0123456789ABCDEF\\"*1024; open(\\"/root/p13-alpine-persist.dat\\",\\"wb\\").write(data); print(\\"EXPECTED_SHA256=\\",hashlib.sha256(data).hexdigest())"
      sync; sync
      free -m
      df -h / /root
      ps -ef | grep -iE "plasma|konsole|dolphin|dbus" | grep -v grep
      GALLIUM_DRIVER=virpipe VTEST_SOCKET_NAME=/tmp/runtime-root/rvgpu-0 EGL_PLATFORM=wayland es2_info 2>&1 | head -n 12 || true
    '`;
    return await window.weblinuxAdapter.runCommand(cmd, 90000);
  }, testId);
  const midOut = midRes.stdout || midRes.output || '';
  console.log('5. APK Install, Persist Write, Mem & RVGPU:\n' + midOut.trim());
  const match = midOut.match(/EXPECTED_SHA256=\s*([0-9a-f]{64})/);
  if (!match) throw new Error('Failed to compute EXPECTED_SHA256');
  const expectedSha = match[1];
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p13-07-alpine-apk.png'), timeout: 60000 });

  console.log('6. Shutting down & warm rebooting Alpine...');
  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(2000);

  const t1 = Date.now();
  await launchAlpine(page, false);
  const warmBootSec = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`7. Warm rebooted in ${warmBootSec}s`);

  const persistRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      `mount | grep wd; dmesg | grep -iE "wd|ext4" | tail -n 8; alpine-root 'sha256sum /root/p13-alpine-persist.dat; echo RELOAD_MARKER_13 > /root/p13-reload.txt; sync; sync'`,
      60000
    );
  });
  const persistOut = persistRes.stdout || persistRes.output || '';
  console.log('8. Warm Reboot Persistence Check:\n' + persistOut.trim());
  if (!persistOut.includes(expectedSha) || persistOut.includes('EXT4-fs error')) {
    throw new Error('Warm reboot persistence failed!');
  }

  console.log('9. Shutting down & reloading browser page...');
  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(800);
  await launchAlpine(page, false);
  await page.waitForTimeout(3000);

  const reloadRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      `dmesg | grep -iE "wd|ext4" | tail -n 8; cat /alpine/root/p13-reload.txt; alpine-root 'sha256sum /root/p13-alpine-persist.dat'`,
      60000
    );
  });
  const reloadOut = reloadRes.stdout || reloadRes.output || '';
  console.log('10. Page Reload Persistence Check:\n' + reloadOut.trim());
  if (!reloadOut.includes(expectedSha) || !reloadOut.includes('RELOAD_MARKER_13') || reloadOut.includes('EXT4-fs error')) {
    throw new Error('Page reload persistence failed!');
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p13-08-alpine-persistence.png'), timeout: 60000 });

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1500);
  await ctx.close();
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  console.log(`ALPINE_QUALIFICATION_PASS COLD=${coldBootSec}s WARM=${warmBootSec}s SHA256=${expectedSha}`);
})();
