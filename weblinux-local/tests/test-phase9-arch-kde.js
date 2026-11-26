const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/ASUS/.gemini/antigravity/brain/a792fb87-9829-4a98-b5f8-e754a1f9dfa1';

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
        return await window.weblinuxAdapter.runCommand('cat /arch/root/kwin.log /arch/root/rvgpu.log /arch/root/dbus.log 2>&1; ls -la /arch/run/hostnode /arch/run/wlserver /arch/tmp/runtime-root 2>&1', 10000);
      });
      throw new Error('Boot error: ' + st.error + '\nDIAG:\n' + (logs.stdout || logs.output || ''));
    }
    if (st.state === 'running' && st.shellReady) return st;
  }
  throw new Error('Timed out waiting for guest shellReady');
}

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  console.log('1. Selecting Arch Linux RISC-V...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(500);
  await page.locator('div:has-text("Arch Linux RISC-V (Community Port + KDE Plasma 6)")').last().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p9-01-arch-selector.png') });

  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(400);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();

  const st = await waitForBoot(page, 120);
  const bootSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`2. Booted in ${bootSec}s:`, st);

  // Verify Arch identity, pacman, networking, mounts, and session logs
  const archInfo = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      'mount | grep wd; dmesg | grep -iE "wd|ext4" | tail -n 8; arch-root /bin/bash -c "uname -a; grep PRETTY_NAME /etc/os-release; pacman --version | head -n 2; pacman -Q | wc -l; curl -sI --max-time 10 https://riscv.mirror.pkgbuild.com/repo/extra/extra.db | head -n 2; cat /root/arch-kde-session.log"',
      30000
    );
  });
  console.log('3. Arch Info & Pacman & Network:\n' + (archInfo.stdout || archInfo.output || '').trim());

  // Wait for Plasma 6.8.3 desktop + panel to render
  console.log('4. Waiting 110s for Plasma 6.8.3 desktop & panel...');
  await page.waitForTimeout(110000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p9-02-arch-kde-desktop.png') });

  const gpuCaps = await page.evaluate(() => ({
    caps: window.weblinuxAdapter?.getGraphicsCapabilities?.(),
    stats: window.gpuExecStats || null,
  }));
  console.log('5. RVGPU Capabilities:', JSON.stringify(gpuCaps));

  // Click Kickoff launcher (bottom-left)
  await page.mouse.click(24, 878);
  await page.waitForTimeout(12000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p9-03-arch-launcher.png'), timeout: 60000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);

  // Launch Konsole & Dolphin with Wayland + D-Bus
  const appEnv = 'export XDG_RUNTIME_DIR=/tmp/runtime-root WAYLAND_DISPLAY=wayland-0 DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus QT_QPA_PLATFORM=wayland';
  await page.evaluate(async (env) => {
    await window.weblinuxAdapter.runCommand(`arch-root /bin/bash -c '${env}; nohup konsole -e /bin/bash -c "uname -a; cat /etc/os-release; sleep 30" >/root/konsole.log 2>&1 </dev/null &'`, 15000);
  }, appEnv);
  await page.waitForTimeout(20000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p9-04-arch-konsole.png'), timeout: 60000 });

  await page.evaluate(async (env) => {
    await window.weblinuxAdapter.runCommand(`arch-root /bin/bash -c '${env}; nohup dolphin /root >/root/dolphin.log 2>&1 </dev/null &'`, 15000);
  }, appEnv);
  await page.waitForTimeout(20000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p9-05-arch-dolphin.png'), timeout: 60000 });

  // Drag Dolphin window titlebar (y=152) to verify interactive move
  await page.mouse.move(300, 152);
  await page.mouse.down();
  await page.mouse.move(480, 210, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'p9-06-arch-window-ops.png'), timeout: 60000 });

  // RVGPU eglinfo + Logs + Memory + write persistence marker + sync
  const memAndPersist = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      'arch-root /bin/bash -c "GALLIUM_DRIVER=virpipe VTEST_SOCKET_NAME=/tmp/runtime-root/rvgpu-0 EGL_PLATFORM=wayland eglinfo -B 2>&1 | head -n 25; free -m; ps -ef | grep -iE \'plasma|konsole|dolphin|dbus\' | grep -v grep; echo ---PLASMA_LOG---; tail -n 10 /root/plasma-shell.log /root/qt.log /root/konsole.log /root/dolphin.log /root/rvgpu.log 2>&1; echo ARCH_PERSIST_OK_9 > /root/arch-persist-test.txt; sync; sync; cat /root/arch-persist-test.txt"',
      30000
    );
  });
  console.log('6. Mem & Procs:\n' + (memAndPersist.stdout || memAndPersist.output || '').trim());

  // Shutdown and reboot in same context to verify home-arch-kde persistence
  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(2000);

  console.log('7. Warm rebooting Arch Linux RISC-V...');
  const t1 = Date.now();
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(400);
  await page.locator('div:has-text("Arch Linux RISC-V (Community Port + KDE Plasma 6)")').last().click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(300);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();

  await waitForBoot(page, 120);
  console.log(`8. Warm rebooted in ${((Date.now() - t1) / 1000).toFixed(1)}s`);

  const persistRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('mount | grep wd; arch-root cat /root/arch-persist-test.txt', 15000);
  });
  console.log('9. Persistence Check:', (persistRes.stdout || persistRes.output || '').trim());

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1500);
  await browser.close();
  console.log('DONE.');
})();
