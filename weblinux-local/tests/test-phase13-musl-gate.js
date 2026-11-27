#!/usr/bin/env node
/**
 * Phase 13.3 — Critical Musl Compatibility Gate under WebLinux /bin/rv
 *
 * Boots WebLinux in Microsoft Edge, downloads & SHA-256-verifies the official
 * Alpine 3.24.4 riscv64 minirootfs inside /tmp/alpine-gate, and executes
 * Alpine musl binaries (/bin/sh, /bin/busybox, /sbin/apk, ld-musl-riscv64.so.1,
 * and a compiled native riscv64 musl C test binary) under the real /bin/rv NOMMU kernel.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = path.join(__dirname, '..', '.tmp-edge-p13-musl-gate');
const MUSL_BIN_PATH = 'D:/weblinux-disks/alpine-kde/staging/musl_gate_test';
const EXPECTED_SHA256 = '010683db6c73b3ad1c334fc8f93f64ae748ef67ae6d69e964929aeaf8517bff3';

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
  const binB64 = fs.readFileSync(MUSL_BIN_PATH).toString('base64');

  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  console.log('1. Booting WebLinux RV64 NOMMU host kernel...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.click('button:has-text("Distributions")');
  await page.waitForTimeout(400);
  await page.locator('div:has-text("Fedora 45 RISC-V (Community Build + KDE Plasma 6)")').last().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Configure Desktop")').click();
  await page.waitForTimeout(400);
  await page.locator('button[data-testid="launch-desktop-btn"], button:has-text("Launch")').first().click();
  await waitForBoot(page, 120);
  console.log('2. Host kernel shellReady. Staging Alpine 3.24.4 minirootfs in /tmp/alpine-gate...');

  const setupCmd = `
    pkill -9 plasmashell 2>/dev/null || true
    rm -rf /tmp/alpine-gate && mkdir -p /tmp/alpine-gate
    cat <<'PY' > /fedora/tmp/ext.py
import tarfile
tarfile.open("/tmp/alpine-minirootfs.tar.gz", "r:gz").extractall("/tmp/alpine-rootfs", filter="fully_trusted")
PY
    fedora-root '
      rm -rf /tmp/alpine-rootfs && mkdir -p /tmp/alpine-rootfs
      curl -fSL --http1.1 --retry 3 --max-time 120 -o /tmp/alpine-minirootfs.tar.gz https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/riscv64/alpine-minirootfs-3.24.4-riscv64.tar.gz
      sha256sum /tmp/alpine-minirootfs.tar.gz
      python3 /tmp/ext.py
    '
    mv /fedora/tmp/alpine-rootfs /tmp/alpine-gate/rootfs
    mkdir -p /tmp/alpine-gate/rootfs/proc /tmp/alpine-gate/rootfs/sys /tmp/alpine-gate/rootfs/dev /tmp/alpine-gate/rootfs/tmp
    mount -t proc none /tmp/alpine-gate/rootfs/proc
    mount -t sysfs none /tmp/alpine-gate/rootfs/sys
    cp -a /dev/null /dev/zero /dev/urandom /dev/random /tmp/alpine-gate/rootfs/dev/ 2>/dev/null || true
    cp /fedora/etc/resolv.conf /tmp/alpine-gate/rootfs/etc/resolv.conf 2>/dev/null || printf "nameserver 1.1.1.1\\n" > /tmp/alpine-gate/rootfs/etc/resolv.conf
    ls -la /tmp/alpine-gate/rootfs/etc/alpine-release
    echo "STAGE_OK=1"
  `;
  const setupRes = await page.evaluate(async (cmd) => {
    return await window.weblinuxAdapter.runCommand(cmd, 180000);
  }, setupCmd);
  const setupOut = setupRes.stdout || setupRes.output || '';
  console.log('3. Stage Output:\n' + setupOut.trim());
  if (!setupOut.includes(EXPECTED_SHA256) || !setupOut.includes('STAGE_OK=1')) {
    throw new Error('Failed to stage & SHA-256 verify Alpine minirootfs in guest');
  }

  // Upload musl_gate_test binary in 200-byte base64 chunks (fits serial line buffer cleanly)
  console.log('4. Writing compiled riscv64 musl_gate_test binary into /tmp/alpine-gate/rootfs/tmp/...');
  const expectedSize = fs.statSync(MUSL_BIN_PATH).size;
  const upOut = await page.evaluate(async (b64) => {
    await window.weblinuxAdapter.runCommand('rm -f /fedora/tmp/musl.b64', 5000);
    const chunk = 200;
    for (let i = 0; i < b64.length; i += chunk) {
      const part = b64.slice(i, i + chunk);
      await window.weblinuxAdapter.runCommand(`printf '%s' '${part}' >> /fedora/tmp/musl.b64`, 5000);
    }
    const r = await window.weblinuxAdapter.runCommand('fedora-root "base64 -d /tmp/musl.b64 > /tmp/musl_gate_test && chmod +x /tmp/musl_gate_test && wc -c /tmp/musl_gate_test"; mv /fedora/tmp/musl_gate_test /tmp/alpine-gate/rootfs/tmp/musl_gate_test', 15000);
    return r.stdout || r.output || '';
  }, binB64);
  console.log(`4b. Upload result (expected ${expectedSize} bytes):`, upOut.trim());

  console.log('5. Executing musl compatibility gate inside Alpine chroot under /bin/rv...');
  const gateCmd = `
    chroot /tmp/alpine-gate/rootfs /bin/sh -c '
      set -e
      echo "=== ALPINE_IDENTITY ==="
      cat /etc/alpine-release
      grep PRETTY_NAME /etc/os-release
      echo "=== BUSYBOX_SH ==="
      /bin/busybox --help | head -n 1
      echo "=== LD_MUSL ==="
      /lib/ld-musl-riscv64.so.1 --list /sbin/apk
      echo "=== APK_VERSION ==="
      apk --version
      echo "=== NATIVE_MUSL_C_TEST ==="
      /tmp/musl_gate_test
      echo "=== APK_UPDATE_AND_ADD ==="
      apk update
      apk add --no-cache tzdata
      echo "MUSL_GATE_COMPLETE=1"
    '
  `;
  const gateRes = await page.evaluate(async (cmd) => {
    return await window.weblinuxAdapter.runCommand(cmd, 240000);
  }, gateCmd);
  const gateOut = gateRes.stdout || gateRes.output || '';
  console.log('6. Musl Gate Output:\n' + gateOut.trim());

  const required = [
    '3.24.4',
    'Alpine Linux v3.24',
    'apk-tools 3.0.9',
    'ld-musl-riscv64.so.1',
    'MALLOC_OK=1',
    'SIGNAL_OK=1',
    'PTHREAD_FUTEX_OK=1',
    'POLL_PIPE_OK=ok',
    'FS_OK=1',
    'SUBPROCESS_VFORK_OK=1',
    'ALL_MUSL_C_TESTS_PASS=1',
    'MUSL_GATE_COMPLETE=1',
  ];
  for (const token of required) {
    if (!gateOut.includes(token)) {
      throw new Error(`Musl compatibility gate missing required token: ${token}`);
    }
  }

  await page.evaluate(async () => { await window.weblinuxAdapter.shutdown(); });
  await page.waitForTimeout(1000);
  await ctx.close();
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  console.log('MUSL_COMPATIBILITY_GATE_PASS=1');
})();
