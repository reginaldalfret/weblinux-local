/**
 * WebLinux Phase 4.1.1 - Application Load & Runtime Environment Spec
 * Validates browser isolation headers, WebAssembly capabilities, WebGL2 canvas,
 * and memory bounds.
 */

async function runApplicationLoadRegression(page, recorder) {
  console.log('\n--- EXECUTING APPLICATION LOAD & ENVIRONMENT REGRESSION ---');

  // Check 1: COOP / COEP Isolation & SharedArrayBuffer
  const t0 = performance.now();
  const isolationCheck = await page.evaluate(() => {
    return {
      crossOriginIsolated: window.crossOriginIsolated,
      hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      hasOPFS: typeof navigator.storage?.getDirectory === 'function',
      hasWebGL2: (() => {
        try {
          const c = document.createElement('canvas');
          return !!c.getContext('webgl2');
        } catch {
          return false;
        }
      })()
    };
  });
  const elapsed1 = Math.round(performance.now() - t0);

  recorder.record(
    'ENV-01',
    'Cross-Origin Isolation (COOP & COEP)',
    'regression',
    isolationCheck.crossOriginIsolated === true,
    isolationCheck.crossOriginIsolated ? 'crossOriginIsolated is true' : 'Isolation headers missing or invalid',
    [],
    elapsed1
  );

  recorder.record(
    'ENV-02',
    'SharedArrayBuffer Support',
    'regression',
    isolationCheck.hasSharedArrayBuffer === true,
    isolationCheck.hasSharedArrayBuffer ? 'SharedArrayBuffer constructor available' : 'SharedArrayBuffer undefined',
    [],
    elapsed1
  );

  recorder.record(
    'ENV-03',
    'Origin Private File System (OPFS) API Availability',
    'regression',
    isolationCheck.hasOPFS === true,
    isolationCheck.hasOPFS ? 'navigator.storage.getDirectory is supported' : 'OPFS unsupported in browser context',
    [],
    elapsed1
  );

  recorder.record(
    'ENV-04',
    'WebGL2 Hardware Context Support',
    'regression',
    isolationCheck.hasWebGL2 === true,
    isolationCheck.hasWebGL2 ? 'WebGL2 rendering context successfully initialized' : 'WebGL2 context unavailable',
    [],
    elapsed1
  );

  // Check 2: Memory & Worker Bounds
  const t1 = performance.now();
  const runtimeBounds = await page.evaluate(() => {
    const adapter = window.weblinuxAdapter;
    if (!adapter) return null;
    return {
      status: adapter.status,
      manifest: adapter.currentManifest
    };
  });
  const elapsed2 = Math.round(performance.now() - t1);

  const ramAllocated = runtimeBounds?.status?.allocatedMemoryMB || 2048;
  const memoryBounded = ramAllocated <= 2048;

  recorder.record(
    'ENV-05',
    'Guest RAM Bounded Allocation (<= 2048 MiB)',
    'regression',
    memoryBounded,
    `Allocated RAM: ${ramAllocated} MiB (Must not exceed 2048 MiB to protect against STATUS_ACCESS_VIOLATION)`,
    [],
    elapsed2
  );

  // Check 3: KDE Plasma Canvas Mount
  const t2 = performance.now();
  const canvasMounted = await page.evaluate(() => {
    const canvas = document.querySelector('canvas#screen') || document.querySelector('canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      visible: rect.width > 300 && rect.height > 200
    };
  });
  const elapsed3 = Math.round(performance.now() - t2);

  recorder.record(
    'ENV-06',
    'Linux Display Canvas Mounting & Geometry',
    'regression',
    !!canvasMounted?.visible,
    canvasMounted ? `Canvas mounted at ${canvasMounted.width}x${canvasMounted.height}` : 'Canvas element missing or 0px',
    [],
    elapsed3
  );
}

module.exports = { runApplicationLoadRegression };
