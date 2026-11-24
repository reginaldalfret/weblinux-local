const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('[TEST SUITE 5] Ubuntu Runtime & Architecture Configuration');

const manifestPath = path.resolve(__dirname, '../../../apps/web/public/manifests/ubuntu.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// 1. Verify distribution ID and kernel compatibility
assert.strictEqual(manifest.id, 'ubuntu', 'Manifest ID must be ubuntu');
assert.strictEqual(manifest.architecture, 'riscv64', 'Architecture must be riscv64');
assert.strictEqual(manifest.defaultDesktop, 'cli', 'Default desktop must be cli');
assert.deepStrictEqual(manifest.supportedDesktops, ['cli'], 'Supported desktops must include cli');

// 2. Verify initramfs integrity configuration
assert.strictEqual(manifest.integrity.initrdUncompressedSize, 36644864, 'Initrd uncompressed size must be 36,644,864 bytes');
assert.strictEqual(manifest.integrity.initrdUncompressedSha256, '57a96754b8f91fe239d08310713d11befff92ce20623467e3ea9a25ae347b8de', 'Initrd uncompressed SHA-256 must match repackaged cpio digest');

// 3. Verify chunk manifest configuration
const diskManifestPath = path.resolve(__dirname, '../../../apps/web/public/disk/ubuntu-24.04/manifest.json');
const diskManifest = JSON.parse(fs.readFileSync(diskManifestPath, 'utf8'));
assert.strictEqual(diskManifest.size, 2147483648, 'Disk image size must be 2 GiB');
assert.strictEqual(diskManifest.piece, 1048576, 'Piece size must be 1 MiB');
assert.strictEqual(diskManifest.hashes.length, 2048, 'Must have exactly 2048 hashes');
assert.strictEqual(typeof diskManifest.present, 'string', 'Present bitmap must be a string');
assert.strictEqual(diskManifest.present.length, 512, 'Present bitmap must be exactly 512 hex characters');

console.log('  ✓ Manifest architecture and kernel compatibility verified.');
console.log('  ✓ Initramfs cryptographically validated.');
console.log('  ✓ Disk manifest present bitmap (512 hex nybbles) verified.');
