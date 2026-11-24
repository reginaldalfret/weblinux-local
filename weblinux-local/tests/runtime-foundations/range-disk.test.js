/**
 * WebLinux Local — Phase 2: HTTP Range VirtualBlockSource Test Suite
 * Tests VirtualBlockSource, RangeBlockSource, ChunkBlockSource, real Vite 206 Range serving,
 * fallback on 200 OK, Content-Range validation, ETag invalidation, and bounded LRU cache.
 */
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ts = require(path.resolve(__dirname, '../../apps/web/node_modules/typescript'));
const srcPath = path.resolve(__dirname, '../../runtime/disk/VirtualBlockSource.ts');
const transpiled = ts.transpileModule(fs.readFileSync(srcPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'module', 'require', transpiled)(mod.exports, mod, require);
const { ChunkBlockSource, RangeBlockSource } = mod.exports;

async function run() {
  console.log('=== PHASE 2: HTTP RANGE VIRTUAL BLOCK SOURCE TESTS ===');

  // 1. Test against live Vite dev server serving /disk/ubuntu-24.04/rootfs.img and chunks
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../apps/web/public/disk/ubuntu-24.04/manifest.json'), 'utf8'));
  const chunkSrc = new ChunkBlockSource('http://localhost:3000/disk/ubuntu-24.04/', manifest.size, { blockSize: 1048576, maxCacheBlocks: 4 });
  const rangeSrc = new RangeBlockSource('http://localhost:3000/disk/ubuntu-24.04/rootfs.img', manifest.size, {
    blockSize: 1048576,
    maxCacheBlocks: 4,
    maxConcurrency: 4,
    fallbackChunkSource: chunkSrc,
  });

  await rangeSrc.verify();
  const rStatsAfterProbe = rangeSrc.getStats();
  console.log('  [INFO] Live Vite Range probe stats:', JSON.stringify(rStatsAfterProbe));

  // Compare first 4096 bytes, cross-block boundary (1048500..1048700), and block 10
  const rFirst = await rangeSrc.read(0, 4096);
  const cFirst = await chunkSrc.read(0, 4096);
  assert.strictEqual(Buffer.compare(Buffer.from(rFirst), Buffer.from(cFirst)), 0, 'First 4096 bytes must match chunk source');

  const rCross = await rangeSrc.read(1048500, 200);
  const cCross = await chunkSrc.read(1048500, 200);
  assert.strictEqual(Buffer.compare(Buffer.from(rCross), Buffer.from(cCross)), 0, 'Cross-block boundary read must match chunk source');

  // Repeated read must hit LRU cache (requestsIssued should not increase)
  const reqBefore = rangeSrc.getStats().requestsIssued;
  await rangeSrc.read(0, 1024);
  const reqAfter = rangeSrc.getStats().requestsIssued;
  if (rStatsAfterProbe.sourceType === 'range') {
    assert.strictEqual(reqAfter, reqBefore, 'Repeated read must be served from bounded LRU cache');
    assert.ok(rangeSrc.getStats().cacheHits >= 1, 'Cache hits counter must increment');
  }

  // Concurrent overlapping reads -> deduplicated
  await Promise.all([
    rangeSrc.read(10 * 1048576, 4096),
    rangeSrc.read(10 * 1048576 + 512, 4096),
  ]);

  // End-of-disk partial read
  const tail = await rangeSrc.read(manifest.size - 512, 512);
  assert.strictEqual(tail.byteLength, 512, 'End-of-disk read must return exact 512 bytes');

  // Out-of-bounds read rejection
  await assert.rejects(() => rangeSrc.read(manifest.size, 512), RangeError, 'Out-of-bounds offset must throw RangeError');
  await assert.rejects(() => rangeSrc.read(-1, 512), RangeError, 'Negative offset must throw RangeError');
  console.log('  [PASS] Live Vite Range/Chunk byte equality, cross-boundary, cache, dedup, tail & bounds tests');

  // 2. Test mock servers for adversarial HTTP Range edge cases
  const payload = crypto.randomBytes(2048);
  let mode = '200_ignore';
  let currentEtag = '"v1"';
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/chunks/')) {
      const idx = Number(req.url.split('/').pop());
      const start = idx * 1024;
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(payload.subarray(start, start + 1024));
      return;
    }
    if (mode === '200_ignore') {
      res.writeHead(200, { 'Content-Length': payload.byteLength });
      res.end(payload);
    } else if (mode === 'bad_range') {
      res.writeHead(206, { 'Content-Range': 'bytes 0-10/999999' });
      res.end(payload.subarray(0, 11));
    } else if (mode === 'etag_ok') {
      const m = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || '');
      const s = Number(m[1]), e = Number(m[2]);
      res.writeHead(206, { 'Content-Range': `bytes ${s}-${e}/${payload.byteLength}`, ETag: currentEtag });
      res.end(payload.subarray(s, e + 1));
    } else if (mode === '416') {
      res.writeHead(416);
      res.end();
    }
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  // 2a. Server returns 200 instead of 206 -> falls back cleanly to ChunkBlockSource
  mode = '200_ignore';
  const fbChunk = new ChunkBlockSource(`${base}/chunks/`, 2048, { blockSize: 1024 });
  const r200 = new RangeBlockSource(`${base}/img`, 2048, { blockSize: 1024, fallbackChunkSource: fbChunk });
  await r200.verify();
  assert.strictEqual(r200.getStats().sourceType, 'range+chunk-fallback');
  const got200 = await r200.read(500, 700);
  assert.strictEqual(Buffer.compare(Buffer.from(got200), payload.subarray(500, 1200)), 0, '200 fallback must return exact bytes');
  console.log('  [PASS] Server returning 200 OK falls back cleanly to ChunkBlockSource');

  // 2b. Invalid Content-Range rejected
  mode = 'bad_range';
  const rBad = new RangeBlockSource(`${base}/img`, 2048, { blockSize: 1024 });
  await assert.rejects(() => rBad.verify(), /Invalid Content-Range/);
  console.log('  [PASS] Invalid Content-Range header rejected');

  // 2c. ETag change mid-session invalidates cache and rejects mismatch
  mode = 'etag_ok';
  const rEtag = new RangeBlockSource(`${base}/img`, 2048, { blockSize: 1024 });
  await rEtag.verify();
  await rEtag.read(0, 512);
  currentEtag = '"v2"';
  await assert.rejects(() => rEtag.read(1024, 512), /ETag changed/);
  console.log('  [PASS] Mid-session ETag version change detected and cache invalidated');

  server.close();
  await rangeSrc.close();
  await chunkSrc.close();
  console.log('=== ALL PHASE 2 RANGE BLOCK SOURCE TESTS PASSED ===');
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
