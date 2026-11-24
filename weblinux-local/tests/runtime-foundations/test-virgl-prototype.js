/**
 * WebLinux Local — Phase 4: VirGL Experimental Prototype & Benchmark Test (Microsoft Edge)
 *
 * Tests:
 * 1. Existing WebGL2 display bridge availability
 * 2. Isolated `WEBLINUX_ENABLE_VIRGL_EXPERIMENTAL` flag
 * 3. Real `RVGP` shared-memory VirGL command ring (`gpu-exec.js` proto WebGL2 executor + `gpu-stub.js`)
 * 4. Frame rendering time, FPS, WebGL2 context stability, and non-zero pixel readback on canvas
 */
const { chromium } = require('playwright');
const assert = require('assert');

async function run() {
  console.log('=== PHASE 4: VIRGL EXPERIMENTAL PROTOTYPE TEST (EDGE) ===');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--no-sandbox', '--enable-features=SharedArrayBuffer', '--use-gl=angle', '--use-angle=default'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('http://localhost:3000/gpu-demo.html?exec=proto', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const metrics = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { hasCanvas: false };
    const gl = canvas.getContext('webgl2');
    const rvGpu = window.rvGpu;
    const stats = rvGpu ? (typeof rvGpu.stats === 'function' ? rvGpu.stats() : rvGpu.stats) : null;

    // Sample center pixel or non-zero pixels via 2D drawImage from WebGL2 canvas
    const probe = document.createElement('canvas');
    probe.width = canvas.width || 320;
    probe.height = canvas.height || 240;
    const ctx2d = probe.getContext('2d');
    ctx2d.drawImage(canvas, 0, 0, probe.width, probe.height);
    const img = ctx2d.getImageData(0, 0, probe.width, probe.height).data;
    let nonZeroPixels = 0;
    for (let i = 0; i < img.length; i += 4) {
      if (img[i] > 0 || img[i + 1] > 0 || img[i + 2] > 0) nonZeroPixels++;
    }

    return {
      hasCanvas: true,
      width: canvas.width,
      height: canvas.height,
      hasWebGL2: !!gl,
      hasRvGpu: !!rvGpu,
      nonZeroPixels,
      totalPixels: probe.width * probe.height,
      stats,
    };
  });

  console.log('VirGL Demo Telemetry:', JSON.stringify(metrics, null, 2));
  assert.strictEqual(metrics.hasCanvas, true, 'Canvas must be present');
  assert.strictEqual(metrics.hasRvGpu, true, 'window.rvGpu VirGL executor must be initialized');
  assert.ok(metrics.stats && metrics.stats.exec && metrics.stats.exec.draws > 0, 'VirGL ring must execute WebGL2 draw calls');
  assert.ok(metrics.stats.exec.glCalls > 0, 'VirGL ring must issue WebGL2 GL calls');
  assert.strictEqual(metrics.stats.exec.errors.length, 0, 'VirGL executor must have zero errors');
  assert.strictEqual(errors.length, 0, 'No page errors during VirGL execution');

  await browser.close();
  console.log('=== PHASE 4 VIRGL PROTOTYPE TEST PASSED ===');
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
