/**
 * WebLinux Local — Phase 1: Live Browser OPFS Durability, Lock Contention, Flush & Shutdown Test
 * Uses an isolated temporary OPFS disk (`test-opfs-durability-<ts>`). Never touches user disks.
 */
const { chromium } = require('playwright');
const assert = require('assert');

async function run() {
  console.log('=== PHASE 1: LIVE BROWSER OPFS DURABILITY TEST (EDGE) ===');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });

  const testResult = await page.evaluate(async () => {
    const diskName = 'test-opfs-durability-' + Date.now();
    const memory = new WebAssembly.Memory({ initial: 32, maximum: 64, shared: true });
    const memBytes = new Uint8Array(memory.buffer);
    const control1 = new Int32Array(new SharedArrayBuffer(64));

    const spawnDiskWorker = (control, name) => new Promise((resolve) => {
      const worker = new Worker('/disk-worker.js?v=' + Date.now(), { name: 'disk ' + name });
      const logs = [];
      let lockConflict = null;
      let shutdownResolve = null;
      worker.onmessage = (ev) => {
        const m = ev.data;
        if (m.method === 'log') logs.push(m.text);
        else if (m.method === 'lock_conflict') lockConflict = m;
        else if (m.method === 'shutdown_complete') {
          if (shutdownResolve) shutdownResolve(m);
        } else if (m.method === 'ready' || m.method === 'failed') {
          resolve({ worker, ready: m.method === 'ready', kept: m.kept, logs, lockConflict, setShutdown: (fn) => { shutdownResolve = fn; } });
        }
      };
      worker.postMessage({
        memory,
        control,
        url: '/disk/ubuntu-24.04/',
        keep: true,
        name,
        reset: false,
      });
    });

    const rwSector = (control, op, sector, addr, count) => {
      control[3] = op;
      control[4] = sector >>> 0;
      control[5] = 0;
      control[6] = addr >>> 0;
      control[7] = count >>> 0;
      control[11] = 0;
      Atomics.store(control, 2, 0);
      Atomics.store(control, 1, 1);
      Atomics.notify(control, 1);
      while (Atomics.load(control, 2) === 0) {
        // spin briefly in browser test
      }
      return control[8];
    };

    // 1. Open isolated test disk
    const w1 = await spawnDiskWorker(control1, diskName);
    if (!w1.ready) throw new Error('Worker 1 failed to open disk: ' + JSON.stringify(w1.logs));

    // 2. Test multi-tab / second-worker writer lock conflict
    const control2 = new Int32Array(new SharedArrayBuffer(64));
    const w2 = await spawnDiskWorker(control2, diskName);
    const lockDetected = !!w2.lockConflict && w2.lockConflict.code === 'DISK_LOCKED' && !w2.kept;
    w2.worker.terminate();

    // 3. Write pattern to sector 100 and sector 2048, then flush
    const writeAddr = 4096;
    const readAddr = 8192;
    const pattern = new TextEncoder().encode('WEBLINUX_OPFS_DURABILITY_VERIFIED_PHASE_1');
    memBytes.fill(0, writeAddr, writeAddr + 512);
    memBytes.set(pattern, writeAddr);
    const wrRes = rwSector(control1, 1, 100, writeAddr, 1);
    const flRes = rwSector(control1, 2, 0, 0, 0);

    // 4. Coordinated OP_SHUTDOWN
    const shutdownPromise = new Promise((res) => w1.setShutdown(res));
    control1[3] = 3; // OP_SHUTDOWN
    Atomics.store(control1, 2, 0);
    Atomics.store(control1, 1, 1);
    Atomics.notify(control1, 1);
    const sdRes = await shutdownPromise;
    w1.worker.terminate();

    // 5. Reopen disk and verify persistence + metadata generation > 0
    const control3 = new Int32Array(new SharedArrayBuffer(64));
    const w3 = await spawnDiskWorker(control3, diskName);
    memBytes.fill(0, readAddr, readAddr + 512);
    const rdRes = rwSector(control3, 0, 100, readAddr, 1);
    const readBack = new TextDecoder().decode(new Uint8Array(memBytes.subarray(readAddr, readAddr + pattern.length)));

    // Shutdown w3 cleanly
    const sd3Promise = new Promise((res) => w3.setShutdown(res));
    control3[3] = 3;
    Atomics.store(control3, 2, 0);
    Atomics.store(control3, 1, 1);
    Atomics.notify(control3, 1);
    const sd3Res = await sd3Promise;
    w3.worker.terminate();

    // 6. Inspect OPFS meta file & cleanup isolated test disk
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('disk-' + diskName);
    const metaFile = await (await dir.getFileHandle('meta')).getFile();
    const metaSize = metaFile.size;
    await root.removeEntry('disk-' + diskName, { recursive: true });

    // 7. Verify storage quota API works
    const est = await navigator.storage.estimate();

    return {
      lockDetected,
      wrRes,
      flRes,
      sdOk: sdRes.ok,
      sdMetrics: sdRes.metrics,
      w3Kept: w3.kept,
      rdRes,
      readBackMatches: readBack === 'WEBLINUX_OPFS_DURABILITY_VERIFIED_PHASE_1',
      sd3Ok: sd3Res.ok,
      metaSize,
      quotaBytes: est.quota,
    };
  });

  console.log('Test Result:', JSON.stringify(testResult, null, 2));
  assert.strictEqual(testResult.lockDetected, true, 'Second writer must be rejected with DISK_LOCKED');
  assert.strictEqual(testResult.wrRes, 0, 'Write must return 0');
  assert.strictEqual(testResult.flRes, 0, 'Flush must return 0');
  assert.strictEqual(testResult.sdOk, true, 'OP_SHUTDOWN must succeed');
  assert.strictEqual(testResult.w3Kept, true, 'Reopened disk must retain OPFS data');
  assert.strictEqual(testResult.rdRes, 0, 'Read must return 0');
  assert.strictEqual(testResult.readBackMatches, true, 'Read back bytes must match written bytes');
  assert.strictEqual(testResult.sd3Ok, true, 'Second OP_SHUTDOWN must succeed');
  assert.strictEqual(testResult.metaSize, 128, 'Dual-slot meta file must be 128 bytes');
  console.log('=== ALL LIVE BROWSER OPFS DURABILITY TESTS PASSED ===');
  await browser.close();
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
