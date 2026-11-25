const { chromium } = require('playwright');

async function test() {
  console.log('Testing OPFS persistence for Ubuntu 24.04.5...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--enable-features=SharedArrayBuffer']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000);

  console.log('Session 1: Boot Ubuntu & write file...');
  const res1 = await page.evaluate(async () => {
    const adapter = window.weblinuxAdapter;
    const m = await adapter.loadManifest('ubuntu');
    await adapter.downloadAssets(m);
    await adapter.boot({
      manifest: m,
      desktop: 'cli',
      enableAudio: false,
      enableNetworking: false,
      enableGpu: false,
      autostartDesktop: false,
      screenCanvas: document.createElement('canvas'),
      displayContainer: document.createElement('div'),
    });
    await new Promise(r => setTimeout(r, 6000));
    const writeResult = await adapter.runCommand('echo PERSIST_DATA_OK > /ubuntu/root/persisted.txt; sync', 5000);
    const readImmediate = await adapter.runCommand('cat /ubuntu/root/persisted.txt', 5000);
    // Wait for disk-worker idle flush to OPFS
    await new Promise(r => setTimeout(r, 3000));
    await adapter.shutdown();
    return { writeResult: writeResult.stdout, readImmediate: readImmediate.stdout };
  });
  console.log('Session 1 immediate read:\n', res1.readImmediate);

  await page.waitForTimeout(2000);

  console.log('Session 2: Boot Ubuntu & read file...');
  const res2 = await page.evaluate(async () => {
    const adapter = window.weblinuxAdapter;
    const m = await adapter.loadManifest('ubuntu');
    await adapter.downloadAssets(m);
    await adapter.boot({
      manifest: m,
      desktop: 'cli',
      enableAudio: false,
      enableNetworking: false,
      enableGpu: false,
      autostartDesktop: false,
      screenCanvas: document.createElement('canvas'),
      displayContainer: document.createElement('div'),
    });
    await new Promise(r => setTimeout(r, 6000));
    const r = await adapter.runCommand('cat /ubuntu/root/persisted.txt', 5000);
    return r.stdout;
  });
  console.log('Session 2 read result:\n', res2);

  const passed = res2 && res2.includes('PERSIST_DATA_OK');
  console.log('PERSISTENCE SUCCESS:', passed);

  await browser.close();
  process.exit(passed ? 0 : 1);
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
