const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/ASUS/.gemini/antigravity/brain/a792fb87-9829-4a98-b5f8-e754a1f9dfa1';
const PROFILE_DIR = path.join(__dirname, '..', '.tmp-edge-p11-profile');

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
        return await window.weblinuxAdapter.runCommand('mount; ls -la /fedora /fedora/usr/bin/plasmashell 2>&1; cat /fedora/tmp/kwin.log /fedora/tmp/rvgpu.log /fedora/tmp/dbus.log /fedora/root/fedora-kde-session.log 2>&1', 10000);
      });
      throw new Error('Boot error: ' + st.error + '\nDIAG:\n' + (logs.stdout || logs.output || ''));
    }
    if (st.state === 'running' && st.shellReady) return st;
  }
  throw new Error('Timed out waiting for guest shellReady');
}

async function launchFedora(page, captureSelector = false) {
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(500);
  await page.locator('div:has-text("Fedora 45 RISC-V (Community Build + KDE Plasma 6)")').last().click();
  await page.waitForTimeout(400);
  if (captureSelector) {
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p11-01-fedora-selector.png') });
  }
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(400);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();
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

  const t0 = Date.now();
  console.log('1. Selecting Fedora 45 RISC-V...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const st = await launchFedora(page, true);
  const coldBootSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`2. Cold booted in ${coldBootSec}s:`, st);

  // Verify Fedora identity, RPM, DNF5, mounts, networking, and session logs
  const sysInfo = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      `mount | grep wd; dmesg | grep -iE "wd|ext4" | tail -n 6; fedora-root 'uname -a; grep PRETTY_NAME /etc/os-release; rpm --version; dnf5 --version | head -n 2; rpm -qa | wc -l; dnf5 repolist; getent hosts example.com; curl -sI --max-time 10 https://example.com | head -n 2; cat /root/fedora-kde-session.log'`,
      60000
    );
  });
  console.log('3. Fedora Info, DNF5 & Network:\n' + (sysInfo.stdout || sysInfo.output || '').trim());

  // Wait for Plasma 6.7.4 desktop + panel to render
  console.log('4. Waiting 135s for Plasma 6.7.4 desktop & panel...');
  await page.waitForTimeout(135000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p11-02-fedora-kde-desktop.png'), timeout: 60000 });

  const gpuCaps = await page.evaluate(() => ({
    caps: window.weblinuxAdapter?.getGraphicsCapabilities?.(),
    stats: window.gpuExecStats || null,
  }));
  console.log('5. RVGPU Capabilities:', JSON.stringify(gpuCaps));

  // Click Kickoff launcher (bottom-left)
  await page.mouse.click(24, 878);
  await page.waitForTimeout(15000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p11-03-fedora-launcher.png'), timeout: 60000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(3000);

  // Launch Konsole & Dolphin
  await page.evaluate(async () => {
    await window.weblinuxAdapter.runCommand(
      `fedora-root 'nohup konsole -e /usr/bin/bash -c "uname -a; cat /etc/os-release; sleep 45" >/tmp/konsole.log 2>&1 </dev/null &'`,
      15000
    );
  });
  await page.waitForTimeout(25000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p11-04-fedora-konsole.png'), timeout: 60000 });

  await page.evaluate(async () => {
    await window.weblinuxAdapter.runCommand(
      `fedora-root 'nohup dolphin /root >/tmp/dolphin.log 2>&1 </dev/null &'`,
      15000
    );
  });
  await page.waitForTimeout(28000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p11-05-fedora-dolphin.png'), timeout: 60000 });

  // Drag window titlebar to verify interactive window move
  await page.mouse.move(300, 152);
  await page.mouse.down();
  await page.mouse.move(480, 210, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p11-06-fedora-window-ops.png'), timeout: 60000 });

  // Write persistence payload + sync, check memory & RVGPU es2_info
  const testId = `P11_FEDORA_PERSIST_${Date.now()}`;
  const midRes = await page.evaluate(async (id) => {
    const cmd = `fedora-root 'python3 -c "import hashlib,time; hdr=b\\"${id}\\\\nTS=\\" + str(time.time()).encode() + b\\"\\\\n\\"; data=hdr + b\\"0123456789ABCDEF\\"*1024; open(\\"/root/p11-fedora-persist.dat\\",\\"wb\\").write(data); print(\\"EXPECTED_SHA256=\\",hashlib.sha256(data).hexdigest())"; sync; sync; free -m; ps -ef | grep -iE "plasma|konsole|dolphin|dbus" | grep -v grep; GALLIUM_DRIVER=virpipe VTEST_SOCKET_NAME=/tmp/runtime-root/rvgpu-0 EGL_PLATFORM=wayland es2_info 2>&1 | head -n 15'`;
    return await window.weblinuxAdapter.runCommand(cmd, 60000);
  }, testId);
  const midOut = midRes.stdout || midRes.output || '';
  console.log('6. Persist Write, Mem & RVGPU es2_info:\n' + midOut.trim());
  const match = midOut.match(/EXPECTED_SHA256=\s*([0-9a-f]{64})/);
  if (!match) throw new Error('Failed to compute EXPECTED_SHA256');
  const expectedSha = match[1];

  console.log('7. Shutting down & warm rebooting Fedora in same persistent context...');
  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(2000);

  const t1 = Date.now();
  await launchFedora(page, false);
  const warmBootSec = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`8. Warm rebooted in ${warmBootSec}s`);

  const persistRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      `mount | grep wd; dmesg | grep -iE "wd|ext4" | tail -n 8; fedora-root 'sha256sum /root/p11-fedora-persist.dat; head -n 2 /root/p11-fedora-persist.dat; echo RELOAD_MARKER_11 > /root/p11-reload.txt; sync; sync'`,
      60000
    );
  });
  const persistOut = persistRes.stdout || persistRes.output || '';
  console.log('9. Warm Reboot Persistence Check:\n' + persistOut.trim());
  if (!persistOut.includes(expectedSha) || persistOut.includes('EXT4-fs error')) {
    throw new Error(`Warm reboot persistence check failed! Expected ${expectedSha}`);
  }

  console.log('10. Shutting down before browser page reload...');
  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  console.log('10b. Reloading browser page...');
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('10c. Re-launching Fedora after reload...');
  await page.waitForTimeout(800);
  await launchFedora(page, false);
  await page.waitForTimeout(3000);

  const reloadRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      `mount | grep wd; dmesg | grep -iE "wd|ext4" | tail -n 8; cat /fedora/root/p11-reload.txt; fedora-root 'sha256sum /root/p11-fedora-persist.dat'`,
      60000
    );
  });
  const reloadOut = reloadRes.stdout || reloadRes.output || '';
  console.log('11. Page Reload Persistence Check:\n' + reloadOut.trim());
  if (!reloadOut.includes(expectedSha) || !reloadOut.includes('RELOAD_MARKER_11') || reloadOut.includes('EXT4-fs error')) {
    throw new Error('Page reload persistence check failed!');
  }

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1500);
  await ctx.close();
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  console.log(`DONE. COLD=${coldBootSec}s WARM=${warmBootSec}s SHA256=${expectedSha}`);
})();
