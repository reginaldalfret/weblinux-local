#!/usr/bin/env node
/**
 * Phase 14.6 — Probe WebLinux Linux 6.6.0 NOMMU Kernel Sandbox Capabilities
 * Checks Seccomp, User Namespaces, PID Namespaces, /proc/buddyinfo, and fork()
 * inside the live /bin/rv runtime in Microsoft Edge.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = path.join(__dirname, '..', '.tmp-edge-p14-sandbox-probe');

async function waitForBoot(page, timeoutSec = 120) {
  for (let i = 0; i < timeoutSec; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      state: window.weblinuxAdapter?.status?.state,
      shellReady: window.weblinuxAdapter?.status?.shellReady,
      error: window.weblinuxAdapter?.status?.error,
    }));
    if (st.error) throw new Error('Boot error: ' + st.error);
    if (st.state === 'running' && st.shellReady) return st;
  }
  throw new Error('Timed out waiting for shellReady');
}

(async () => {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(400);
  await page.locator('div:has-text("Alpine Linux")').last().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Launch WebLinux")').first().click();
  await waitForBoot(page, 120);

  const probeCmd = `
    echo "=== KERNEL ==="; uname -a
    echo "=== PROC_STATUS_SECCOMP ==="; grep -iE "Seccomp|NoNewPrivs|Cap" /proc/self/status || true
    echo "=== PROC_CONFIG_GZ ==="; [ -f /proc/config.gz ] && zcat /proc/config.gz | grep -E "SECCOMP|USER_NS|PID_NS|NET_NS|NAMESPACES|MMU|COMPACTION" || echo "NO_PROC_CONFIG_GZ"
    echo "=== SYSCTL_USERNS ==="; cat /proc/sys/kernel/unprivileged_userns_clone 2>&1 || true; cat /proc/sys/user/max_user_namespaces 2>&1 || true
    echo "=== BUDDYINFO ==="; cat /proc/buddyinfo
    echo "=== TEST_USER_NS ==="; alpine-root 'unshare -U true 2>&1; echo RC_USERNS=$?'
    echo "=== TEST_PID_NS ==="; alpine-root 'unshare -p -f true 2>&1; echo RC_PIDNS=$?'
    echo "=== TEST_SECCOMP_PYTHON ==="; alpine-root 'python3 -c "import ctypes; libc=ctypes.CDLL(None); print(\"PR_GET_SECCOMP=\", libc.prctl(21,0,0,0,0))" 2>&1'
  `;
  const res = await page.evaluate(async (cmd) => {
    return await window.weblinuxAdapter.runCommand(cmd, 60000);
  }, probeCmd);
  console.log((res.stdout || res.output || '').trim());

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1000);
  await ctx.close();
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
})();
