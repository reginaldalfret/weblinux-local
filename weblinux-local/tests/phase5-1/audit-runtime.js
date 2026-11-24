/**
 * WebLinux Local - Phase 5.1 Runtime Audit Script
 * Executes real discovery commands inside Debian guest userspace
 * using launchPersistentContext to inspect available files, desktop launchers,
 * session scripts, and compositor binaries.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('=== Starting Phase 5.1 Guest Runtime Audit ===');
  const PROFILE_DIR = path.resolve(__dirname, '.audit-edge-profile');
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=SharedArrayBuffer', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = context.pages()[0] || await context.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('Launching WebLinux baseline...');
  await page.click('button:has-text("Launch WebLinux")');

  console.log('Waiting for guest kernel to reach running state...');
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  console.log('Allowing desktop session to settle (25s)...');
  await page.waitForTimeout(25000);

  const runRaw = async (cmd) => {
    return await page.evaluate(async (command) => {
      const res = await window.weblinuxAdapter.runCommand(command, 8000);
      return {
        cmd: command,
        exitCode: res.exitCode,
        stdout: (res.stdout || res.out || '').trim(),
        stderr: (res.stderr || res.err || '').trim()
      };
    }, cmd);
  };

  const results = {};

  const auditCommands = [
    'mount',
    'df -h',
    'free -m',
    'ps',
    'ls -la /',
    'ls -la /dev/',
    'cat /init',
    'ls -la /etc/',
    'find / -name "*plasma*" 2>/dev/null | head -n 30 || true',
    'find / -name "*konsole*" 2>/dev/null | head -n 30 || true',
    'find / -name "*desktop*" 2>/dev/null | head -n 30 || true',
    'which konsole dolphin kwin_wayland plasmashell gnome-shell mutter labwc xfce4-session 2>&1 || true'
  ];

  console.log('\n--- Executing Raw Audit Commands inside Guest Shell ---');
  for (const cmd of auditCommands) {
    try {
      const res = await runRaw(cmd);
      results[cmd] = res;
      console.log(`\n[$ ${cmd}] (exitCode: ${res.exitCode})`);
      console.log(res.stdout || res.stderr || '(empty output)');
    } catch (e) {
      console.error(`Command failed: ${cmd}`, e.message);
      results[cmd] = { cmd, error: e.message };
    }
  }

  const outPath = path.resolve(__dirname, 'audit-results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ Audit output written to ${outPath}`);

  await context.close();
  console.log('=== Audit Complete ===');
})().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
