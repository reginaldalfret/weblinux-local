/**
 * Automated Test Suite: Distribution Manifest Schema & Integrity Verification
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const manifestsDir = path.join(__dirname, '..', 'image-builder', 'manifests');
const manifestFiles = fs.readdirSync(manifestsDir).filter(f => f.endsWith('.json'));

console.log(`Found ${manifestFiles.length} distribution manifests to validate...`);

let totalPassed = 0;

for (const file of manifestFiles) {
  const filePath = path.join(manifestsDir, file);
  const raw = fs.readFileSync(filePath, 'utf8');
  const manifest = JSON.parse(raw);

  console.log(`\nValidating manifest: ${file} (${manifest.name})`);

  // Schema assertions
  assert.ok(manifest.id, 'Manifest must contain id');
  assert.ok(manifest.name, 'Manifest must contain name');
  assert.ok(manifest.releaseVersion, 'Manifest must contain releaseVersion');
  assert.ok(manifest.architecture, 'Manifest must contain architecture');
  assert.ok(manifest.kernelCompatibility, 'Manifest must contain kernelCompatibility');
  assert.ok(manifest.defaultDesktop, 'Manifest must contain defaultDesktop');
  assert.ok(Array.isArray(manifest.supportedDesktops) && manifest.supportedDesktops.length > 0, 'supportedDesktops must be non-empty array');
  assert.ok(manifest.imageSource, 'imageSource must be defined');
  assert.ok(manifest.imageSource.chunkSize === 1048576, 'chunkSize must be 1 MiB (1048576 bytes)');
  assert.ok(manifest.runtimeRequirements, 'runtimeRequirements must be defined');
  assert.ok(manifest.runtimeRequirements.minMemoryMB >= 2048, 'minMemoryMB must be >= 2048');
  assert.ok(manifest.licensing, 'licensing info must be defined');
  assert.ok(manifest.validationStatus, 'validationStatus must be defined');

  // Verify status policy: Debian is validated; others are experimental/planned
  if (manifest.id === 'debian') {
    assert.strictEqual(manifest.validationStatus, 'validated', 'Debian must be validated tier');
  } else {
    assert.strictEqual(manifest.validationStatus, 'experimental', `${manifest.id} must be honestly marked as experimental until verified`);
  }

  console.log(`  ✓ Schema conforms to WebLinux Distribution Specification`);
  console.log(`  ✓ Architecture: ${manifest.architecture} | Kernel: ${manifest.kernelCompatibility}`);
  console.log(`  ✓ Desktops: ${manifest.supportedDesktops.join(', ')} | Status: ${manifest.validationStatus}`);
  totalPassed++;
}

console.log(`\n======================================================`);
console.log(`All ${totalPassed} distribution manifests passed validation!`);
console.log(`======================================================`);
