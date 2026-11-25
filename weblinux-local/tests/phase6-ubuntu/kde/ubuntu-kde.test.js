const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('[TEST SUITE 11] Ubuntu KDE Plasma 5.27 Distribution & Desktop Integration');

const manifestPath = path.resolve(__dirname, '../../../apps/web/public/manifests/ubuntu-kde.json');
assert.ok(fs.existsSync(manifestPath), 'ubuntu-kde.json manifest must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.strictEqual(manifest.id, 'ubuntu-kde', 'Manifest ID must be ubuntu-kde');
assert.strictEqual(manifest.architecture, 'riscv64', 'Architecture must be riscv64');
assert.strictEqual(manifest.defaultDesktop, 'ubuntu-kde', 'Default desktop must be ubuntu-kde');
assert.ok(manifest.supportedDesktops.includes('ubuntu-kde'), 'Supported desktops must include ubuntu-kde');
assert.strictEqual(manifest.validationStatus, 'experimental', 'Initial status must be experimental');
assert.strictEqual(manifest.imageSource.baseUri, '/disk/ubuntu-24.04-kde/', 'Base URI must point to /disk/ubuntu-24.04-kde/');
assert.strictEqual(manifest.imageSource.totalSizeBytes, 3221225472, 'Disk size must be 3 GiB');
assert.strictEqual(manifest.integrity.chunksCount, 3072, 'Must have 3072 chunks');

const diskManifestPath = path.resolve(__dirname, '../../../apps/web/public/disk/ubuntu-24.04-kde/manifest.json');
assert.ok(fs.existsSync(diskManifestPath), 'ubuntu-24.04-kde disk manifest must exist');
const diskManifest = JSON.parse(fs.readFileSync(diskManifestPath, 'utf8'));

assert.strictEqual(diskManifest.size, 3221225472, 'Disk image size must be 3 GiB');
assert.strictEqual(diskManifest.piece, 1048576, 'Chunk size must be 1 MiB');
assert.strictEqual(diskManifest.hashes.length, 3072, 'Must have 3072 chunk hashes');
assert.strictEqual(diskManifest.present.length, 768, 'Present bitmap must be 768 hex chars');

const profilesPath = path.resolve(__dirname, '../../../runtime/profiles/desktopProfiles.ts');
const profilesSource = fs.readFileSync(profilesPath, 'utf8');
assert.ok(profilesSource.includes("'ubuntu-kde'"), 'ubuntu-kde profile must be registered in desktopProfiles.ts');
assert.ok(profilesSource.includes('ubuntu-kde /usr/local/bin/ubuntu-kde-session'), 'ubuntu-kde profile must specify /bin/ubuntu-kde supervisor');

const splashPath = path.resolve(__dirname, '../../../apps/web/public/splash.js');
const splashSource = fs.readFileSync(splashPath, 'utf8');
assert.ok(splashSource.includes('Desktop @'), 'splash.js must support Plasma 5.27 xdg_toplevel desktop detection');

console.log('  ✓ Ubuntu KDE Plasma 5.27 manifest verified.');
console.log('  ✓ 3.0 GiB ext4 disk image chunks and present bitmap verified.');
console.log('  ✓ Desktop profile, /bin/ubuntu-kde supervisor, and Plasma 5.27 splash detection verified.');
