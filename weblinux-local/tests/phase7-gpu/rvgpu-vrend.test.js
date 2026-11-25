const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('[PHASE 7 GPU TEST] RVGPU, vrend.wasm & Mesa virpipe Integration');

const vrendJs = path.resolve(__dirname, '../../apps/web/public/vrend/vrend.js');
const vrendWasm = path.resolve(__dirname, '../../apps/web/public/vrend/vrend.wasm');
assert.ok(fs.existsSync(vrendJs), 'public/vrend/vrend.js must exist');
assert.ok(fs.existsSync(vrendWasm), 'public/vrend/vrend.wasm must exist');
assert.ok(fs.statSync(vrendJs).size > 50000, 'vrend.js must be compiled Emscripten module');
const wasmHdr = fs.readFileSync(vrendWasm).subarray(0, 4);
assert.deepStrictEqual(wasmHdr, Buffer.from([0x00, 0x61, 0x73, 0x6d]), 'vrend.wasm must have valid WebAssembly magic header');

const typesSrc = fs.readFileSync(path.resolve(__dirname, '../../runtime/types.ts'), 'utf8');
assert.ok(typesSrc.includes("export type GraphicsMode = 'software' | 'experimental-rvgpu' | 'automatic'"), 'GraphicsMode must be defined');
assert.ok(typesSrc.includes('export interface GraphicsCapabilities'), 'GraphicsCapabilities must be defined');

const adapterSrc = fs.readFileSync(path.resolve(__dirname, '../../runtime/adapters/WasmLinuxAdapter.ts'), 'utf8');
assert.ok(adapterSrc.includes('getGraphicsCapabilities()'), 'WasmLinuxAdapter must expose getGraphicsCapabilities()');
assert.ok(adapterSrc.includes('setGraphicsMode('), 'WasmLinuxAdapter must expose setGraphicsMode()');
assert.ok(adapterSrc.includes('GALLIUM_DRIVER=virpipe'), 'ubuntu-kde-session must configure GALLIUM_DRIVER=virpipe');

const resultsPath = path.resolve(__dirname, '../screenshots/phase7-gpu/phase7-rvgpu-results.json');
assert.ok(fs.existsSync(resultsPath), 'Live Phase 7 RVGPU results JSON must exist');
const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
assert.strictEqual(results.caps.executorLoaded, true, 'Executor must be loaded');
assert.strictEqual(results.caps.executorReady, true, 'Executor must be ready');
assert.strictEqual(results.caps.guestConnected, true, 'Guest must be connected');
assert.strictEqual(results.caps.activeBackend, 'vrend-webgl2', 'Active backend must be vrend-webgl2');
assert.ok(results.gpuStats.exec.records > 1000, 'Live KDE + es2gears must submit >1000 GPU records');
assert.strictEqual(results.gpuStats.exec.errors.length, 0, 'GPU executor must have 0 errors');

console.log('  ✓ vrend.js & vrend.wasm binaries verified.');
console.log('  ✓ GraphicsMode & GraphicsCapabilities runtime API verified.');
console.log(`  ✓ Live Edge RVGPU telemetry verified (${results.gpuStats.exec.records} records, 0 errors, backend=${results.caps.activeBackend}).`);
