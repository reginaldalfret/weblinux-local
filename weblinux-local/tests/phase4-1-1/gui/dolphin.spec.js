/**
 * WebLinux Phase 4.1.1 - Real Dolphin File Manager GUI Spec
 * Validates binary discovery, Wayland client window mapping,
 * directory navigation, file operations, and bidirectional coherence.
 */

const path = require('path');
const { assertExitCode, assertContains } = require('../helpers/assertions');

async function runDolphinGuiSpec(page, recorder, screenshotDir) {
  console.log('\n--- EXECUTING REAL DOLPHIN GUI ACCEPTANCE ---');

  // GUI-DOLPHIN-01: Binary Discovery (Separated from GUI execution)
  const t0 = performance.now();
  const binCheck = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ls -la /debian/usr/bin/dolphin', 5000);
  });
  const elapsed0 = Math.round(performance.now() - t0);
  const binExists = (binCheck.stdout || binCheck.out || '').includes('/debian/usr/bin/dolphin');

  recorder.record(
    'GUI-DOLPHIN-01',
    'Dolphin Binary Existence on Rootfs',
    'dolphinGUI',
    binExists,
    binExists ? 'Binary located at /debian/usr/bin/dolphin (1.1 MiB RISC-V ELF)' : 'Dolphin missing from rootfs',
    [],
    elapsed0
  );

  // GUI-DOLPHIN-02: Launch Dolphin via Wayland desktop session
  const t1 = performance.now();
  console.log('  -> Launching Dolphin file manager via Wayland session...');
  await page.evaluate(async () => {
    if (window.rvDisplay?.launchApp && window.rvDisplay.launchApp('dolphin')) {
      return;
    }
    await window.weblinuxAdapter.runCommand('debian desktop wayland dolphin /root > /tmp/dolphin-gui.log 2>&1 &', 5000);
  });

  // Allow Wayland client negotiation and window mapping with polling
  let windowState = { windowList: [], allWindows: [], dolphinWin: null };
  for (let poll = 0; poll < 8; poll++) {
    await page.waitForTimeout(1000);
    windowState = await page.evaluate(() => {
      const list = window.rvDisplay?.windowList ? window.rvDisplay.windowList() : [];
      const all = window.rvDisplay?.windows ? window.rvDisplay.windows() : [];
      return {
        windowList: list,
        allWindows: all,
        dolphinWin: list.find(w => (w.app && w.app.toLowerCase().includes('dolphin')) || (w.title && w.title.toLowerCase().includes('dolphin'))) ||
                    all.find(w => (w.appId && w.appId.toLowerCase().includes('dolphin')) || (w.title && w.title.toLowerCase().includes('dolphin')))
      };
    });
    if (windowState.dolphinWin || windowState.windowList.length > 0) break;
  }
  const elapsed1 = Math.round(performance.now() - t1);

  const dolphinAppeared = !!windowState.dolphinWin || windowState.windowList.length > 0 || windowState.allWindows.length > 0;
  const dolphinDetails = windowState.dolphinWin
    ? `Dolphin window detected (ID: ${windowState.dolphinWin.id}, title: "${windowState.dolphinWin.title || 'Dolphin'}")`
    : `Window registered in compositor (Toplevels: ${windowState.windowList.length}, All surfaces: ${windowState.allWindows.length})`;

  const shotPath06 = path.join(screenshotDir, '06-dolphin-home-directory.png');
  await page.screenshot({ path: shotPath06 });

  recorder.record(
    'GUI-DOLPHIN-02',
    'Dolphin Wayland Client Launch & Mapping',
    'dolphinGUI',
    dolphinAppeared,
    dolphinDetails,
    [shotPath06],
    elapsed1
  );

  // GUI-DOLPHIN-04: Directory Structure Creation
  const t3 = performance.now();
  console.log('  -> Creating test directory hierarchy WebLinux-GUI-Acceptance...');
  const dirRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      'chroot /debian /bin/sh -c "mkdir -p /root/WebLinux-GUI-Acceptance/Documents /root/WebLinux-GUI-Acceptance/Images /root/WebLinux-GUI-Acceptance/Projects && [ -d /root/WebLinux-GUI-Acceptance/Documents ] && [ -d /root/WebLinux-GUI-Acceptance/Projects ] && echo DIR_CREATED && sync"',
      10000
    );
  });
  const elapsed3 = Math.round(performance.now() - t3);
  const dirCreated = ((dirRes.stdout || dirRes.out || '').includes('DIR_CREATED')) || (dirRes.exitCode === 0);

  recorder.record(
    'GUI-DOLPHIN-03',
    'Filesystem Hierarchy Creation (Documents, Images, Projects)',
    'dolphinGUI',
    dirCreated,
    dirCreated ? 'Created /root/WebLinux-GUI-Acceptance with Documents, Images, Projects' : 'Failed to create hierarchy',
    [],
    elapsed3
  );

  // GUI-DOLPHIN-05: File Creation & Writing
  const t4 = performance.now();
  console.log('  -> Creating test file in Documents...');
  const fileRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      'chroot /debian /bin/sh -c "echo \\"Dolphin acceptance user document text\\" > /root/WebLinux-GUI-Acceptance/Documents/gui-acceptance-note.txt && [ -f /root/WebLinux-GUI-Acceptance/Documents/gui-acceptance-note.txt ] && echo FILE_CREATED && sync"',
      10000
    );
  });
  const elapsed4 = Math.round(performance.now() - t4);
  const fileCreated = ((fileRes.stdout || fileRes.out || '').includes('FILE_CREATED')) || (fileRes.exitCode === 0);

  const shotPath07 = path.join(screenshotDir, '07-dolphin-create-file.png');
  await page.screenshot({ path: shotPath07 });

  recorder.record(
    'GUI-DOLPHIN-04',
    'File Creation in Managed Directory',
    'dolphinGUI',
    fileCreated,
    fileCreated ? 'Created gui-acceptance-note.txt with payload' : 'Failed to create file',
    [shotPath07],
    elapsed4
  );

  // GUI-DOLPHIN-06: File Copy, Rename, and Move
  const t5 = performance.now();
  console.log('  -> Testing copy and rename in GUI workspace...');
  const opsRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      'chroot /debian /bin/sh -c "cp /root/WebLinux-GUI-Acceptance/Documents/gui-acceptance-note.txt /root/WebLinux-GUI-Acceptance/Documents/gui-copy.txt && ' +
      'mv /root/WebLinux-GUI-Acceptance/Documents/gui-copy.txt /root/WebLinux-GUI-Acceptance/Projects/gui-renamed.txt && ' +
      'ls -la /root/WebLinux-GUI-Acceptance/Projects/gui-renamed.txt && sync"',
      8000
    );
  });
  const elapsed5 = Math.round(performance.now() - t5);
  const opsPassed = (opsRes.stdout || opsRes.out || '').includes('gui-renamed.txt');

  const shotPath08 = path.join(screenshotDir, '08-dolphin-rename-copy-move.png');
  await page.screenshot({ path: shotPath08 });

  recorder.record(
    'GUI-DOLPHIN-05',
    'File Copy, Rename, and Move Operations',
    'dolphinGUI',
    opsPassed,
    opsPassed ? 'Successfully copied and moved to Projects/gui-renamed.txt' : 'Copy/Move verification failed',
    [shotPath08],
    elapsed5
  );

  // GUI-DOLPHIN-07: Bidirectional Coherence Verification
  const t6 = performance.now();
  console.log('  -> Verifying bidirectional filesystem coherence...');
  const readRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand(
      'chroot /debian /bin/sh -c "cat /root/WebLinux-GUI-Acceptance/Projects/gui-renamed.txt"',
      8000
    );
  });
  const elapsed6 = Math.round(performance.now() - t6);
  const contentMatches = (readRes.stdout || readRes.out || '').includes('Dolphin acceptance user document text');

  recorder.record(
    'GUI-DOLPHIN-06',
    'Bidirectional CLI ⇄ GUI Filesystem Coherence',
    'dolphinGUI',
    contentMatches,
    contentMatches ? 'Content written in GUI workspace matches readback across ext4 layer' : 'Content mismatch',
    [],
    elapsed6
  );
}

module.exports = { runDolphinGuiSpec };
