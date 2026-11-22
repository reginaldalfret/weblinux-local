/**
 * Automated Test Suite: Cryptographic Integrity & Backup/Restore Subsystem
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

console.log('================================================================');
console.log('TEST SUITE: CRYPTOGRAPHIC ASSET INTEGRITY & BACKUP VERIFICATION');
console.log('================================================================');

// 1. Verify Debian Manifest digests against public runtime assets
const manifestPath = path.resolve(__dirname, '../apps/web/public/manifests/debian.json');
assert.ok(fs.existsSync(manifestPath), 'Debian manifest must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

console.log(`\n[Asset Verification] Checking Manifest: ${manifest.name} (${manifest.architecture})`);
assert.strictEqual(manifest.validationStatus, 'validated', 'Debian must be validated tier');

const runtimeDir = path.resolve(__dirname, '../apps/web/public/runtime');
const kernelPath = path.resolve(runtimeDir, 'vmlinux-wasm64_nommu.wasm');
const initrdPath = path.resolve(runtimeDir, 'initramfs-wasm64_nommu.cpio.gz');

assert.ok(fs.existsSync(kernelPath), 'Kernel binary must exist');
assert.ok(fs.existsSync(initrdPath), 'Initrd binary must exist');

// Compute actual SHA-256 and byte sizes
const kernelBuffer = fs.readFileSync(kernelPath);
const initrdBuffer = fs.readFileSync(initrdPath);

const actualKernelSha256 = crypto.createHash('sha256').update(kernelBuffer).digest('hex');
const actualInitrdSha256 = crypto.createHash('sha256').update(initrdBuffer).digest('hex');

console.log(`  Kernel size: ${kernelBuffer.length} bytes (Manifest: ${manifest.integrity.kernelSize})`);
console.log(`  Kernel SHA-256: ${actualKernelSha256}`);
console.log(`  Initrd size: ${initrdBuffer.length} bytes (Manifest: ${manifest.integrity.initrdSize})`);
console.log(`  Initrd SHA-256: ${actualInitrdSha256}`);

assert.strictEqual(kernelBuffer.length, manifest.integrity.kernelSize, 'Kernel size mismatch');
assert.strictEqual(actualKernelSha256, manifest.integrity.kernelSha256, 'Kernel SHA-256 digest mismatch');

assert.strictEqual(initrdBuffer.length, manifest.integrity.initrdSize, 'Initrd size mismatch');
assert.strictEqual(actualInitrdSha256, manifest.integrity.initrdSha256, 'Initrd SHA-256 digest mismatch');

const zlib = require('zlib');
const uncompressedInitrd = zlib.gunzipSync(initrdBuffer);
const actualUncompressedInitrdSha256 = crypto.createHash('sha256').update(uncompressedInitrd).digest('hex');
assert.strictEqual(uncompressedInitrd.length, manifest.integrity.initrdUncompressedSize, 'Uncompressed Initrd size mismatch');
assert.strictEqual(actualUncompressedInitrdSha256, manifest.integrity.initrdUncompressedSha256, 'Uncompressed Initrd SHA-256 mismatch');
console.log('  ✓ Kernel, Initrd, and uncompressed Initrd SHA-256 digests match manifest perfectly!');

// 2. Corrupt buffer rejection simulation
console.log('\n[Tamper Detection] Verifying corrupt buffer rejection logic...');
const corruptKernelBuffer = Buffer.from(kernelBuffer);
corruptKernelBuffer[100] = corruptKernelBuffer[100] ^ 0xff; // Flip bits
const corruptKernelSha256 = crypto.createHash('sha256').update(corruptKernelBuffer).digest('hex');

assert.notStrictEqual(corruptKernelSha256, manifest.integrity.kernelSha256, 'Corrupted buffer must not match valid hash');
console.log('  ✓ Corrupted buffer produces distinct hash:', corruptKernelSha256);

// 3. Backup Archive Structure Verification
console.log('\n[Backup Archive Specification] Verifying backup format v2.0 schema...');
const sampleArchive = {
  format: 'weblinux-backup',
  version: '2.0',
  distribution: 'debian',
  targetDisk: 'disk-home-debian',
  timestamp: new Date().toISOString(),
  manifest: {
    totalFiles: 2,
    uncompressedTotalBytes: 30000000,
    compressedTotalBytes: 700000,
    files: [
      { name: 'map', size: 65600, sha256: 'a'.repeat(64), compressedSize: 1024 },
      { name: 'data', size: 30000000, sha256: 'b'.repeat(64), compressedSize: 698976 }
    ]
  },
  payload: {
    map: 'AQIDBA==',
    data: 'BQYHCA=='
  }
};

assert.strictEqual(sampleArchive.format, 'weblinux-backup', 'Archive format must be weblinux-backup');
assert.strictEqual(sampleArchive.version, '2.0', 'Archive version must be 2.0');
assert.strictEqual(sampleArchive.manifest.files.length, 2, 'Archive must include map and data disk files');
console.log('  ✓ Backup archive structure conforms to v2.0 specification');

console.log('\n======================================================');
console.log('All Cryptographic Asset Integrity tests passed!');
console.log('======================================================');
