/**
 * Automated Test Suite: Boot Binary Preflight & Integrity Verification
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const runtimeDir = path.join(__dirname, '..', 'apps', 'web', 'public', 'runtime');

console.log('Validating local kernel and runtime binaries in:', runtimeDir);

const expectedFiles = [
  { name: 'vmlinux-wasm64_nommu.wasm', minSize: 5000000, magic: Buffer.from([0x00, 0x61, 0x73, 0x6d]) }, // '\0asm'
  { name: 'initramfs-wasm64_nommu.cpio.gz', minSize: 10000000, magic: Buffer.from([0x1f, 0x8b]) }, // gzip header
  { name: 'linux.js', minSize: 20000 },
  { name: 'linux-worker.js', minSize: 50000 },
  { name: 'disk-worker.js', minSize: 30000 },
  { name: 'display.js', minSize: 100000 },
  { name: 'audio.js', minSize: 5000 },
  { name: 'rv.sha256', minSize: 32 },
];

for (const exp of expectedFiles) {
  const filePath = path.join(runtimeDir, exp.name);
  assert.ok(fs.existsSync(filePath), `Binary asset ${exp.name} must exist on disk`);
  const stat = fs.statSync(filePath);
  assert.ok(stat.size >= exp.minSize, `${exp.name} size (${stat.size} bytes) below minimum expected (${exp.minSize} bytes)`);

  if (exp.magic) {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(exp.magic.length);
    fs.readSync(fd, header, 0, exp.magic.length, 0);
    fs.closeSync(fd);
    assert.deepStrictEqual(header, exp.magic, `File ${exp.name} magic header mismatch`);
    console.log(`  ✓ ${exp.name}: ${stat.size} bytes (Magic bytes verified: ${header.toString('hex')})`);
  } else {
    console.log(`  ✓ ${exp.name}: ${stat.size} bytes`);
  }
}

console.log(`\nAll ${expectedFiles.length} runtime assets passed binary integrity preflight tests!`);
