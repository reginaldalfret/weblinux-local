const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('[TEST SUITE 10] Ubuntu GNOME 46 Distribution & Desktop Integration');

const rootDir = path.resolve(__dirname, '../../../');
const manifestPath = path.join(rootDir, 'apps/web/public/manifests/ubuntu-gnome.json');
assert(fs.existsSync(manifestPath), 'ubuntu-gnome.json manifest must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// 1. Verify distribution ID and desktop metadata
assert.strictEqual(manifest.id, 'ubuntu-gnome', 'Manifest ID must be ubuntu-gnome');
assert.strictEqual(manifest.architecture, 'riscv64', 'Architecture must be riscv64');
assert.strictEqual(manifest.defaultDesktop, 'ubuntu-gnome', 'Default desktop must be ubuntu-gnome');
assert.ok(manifest.supportedDesktops.includes('ubuntu-gnome'), 'Supported desktops must include ubuntu-gnome');

// 2. Verify disk image and chunk manifest
const diskDir = path.join(rootDir, 'apps/web/public/disk/ubuntu-24.04-gnome');
assert(fs.existsSync(diskDir), 'ubuntu-24.04-gnome disk chunks directory must exist');
const diskManifest = JSON.parse(fs.readFileSync(path.join(diskDir, 'manifest.json'), 'utf8'));
assert.strictEqual(diskManifest.size, 3221225472, 'Disk image size must be 3 GiB');
assert.strictEqual(diskManifest.piece, 1048576, 'Piece size must be 1 MiB');
assert.strictEqual(diskManifest.hashes.length, 3072, 'Must have exactly 3072 chunk hashes');
assert.strictEqual(diskManifest.present.length, 768, 'Present bitmap must be exactly 768 hex characters');
assert.strictEqual(manifest.integrity.chunksCount, 3072, 'Manifest chunks count must match 3072');
assert.strictEqual(manifest.integrity.nonZeroChunksCount, 776, 'Manifest non-zero chunks count must match 776');

// 3. Verify desktop profile registration
const profilesPath = path.join(rootDir, 'runtime/profiles/desktopProfiles.ts');
const profilesSrc = fs.readFileSync(profilesPath, 'utf8');
assert(profilesSrc.includes("'ubuntu-gnome': {"), 'desktopProfiles.ts must register ubuntu-gnome profile');
assert(profilesSrc.includes("rootfsManifestId: 'ubuntu-24.04-gnome'"), 'Profile must reference ubuntu-24.04-gnome rootfs');
assert(profilesSrc.includes("compositor: 'Mutter 46 (Nested Wayland Session)'"), 'Profile must specify Mutter 46 compositor');

console.log('  ✓ Ubuntu GNOME 46 manifest verified.');
console.log('  ✓ 3.0 GiB ext4 disk image chunks and present bitmap verified.');
console.log('  ✓ Official Desktop Profile and Mutter 46 compositor registration verified.');
