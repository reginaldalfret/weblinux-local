const fs = require('fs');
const path = require('path');
const assert = require('assert');

const MANIFEST_PATH = path.resolve(__dirname, '../../../apps/web/public/manifests/ubuntu.json');

console.log('--- TEST: Ubuntu Distribution Manifest Integration ---');

assert.ok(fs.existsSync(MANIFEST_PATH), 'public/manifests/ubuntu.json must exist');
const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

// Verify distribution metadata
assert.strictEqual(m.id, 'ubuntu', 'Manifest ID must be ubuntu');
assert.strictEqual(m.architecture, 'riscv64', 'Architecture must be riscv64');
assert.strictEqual(m.releaseVersion, '24.04.5 LTS', 'Release version must be 24.04.5 LTS');
assert.strictEqual(m.packageManager, 'apt', 'Package manager must be apt');

// Verify imageSource mapping
assert.strictEqual(m.imageSource.baseUri, '/disk/ubuntu-24.04/', 'baseUri must point to /disk/ubuntu-24.04/');
assert.strictEqual(m.imageSource.chunkSize, 1048576, 'chunkSize must be 1048576');
assert.strictEqual(m.imageSource.totalSizeBytes, 2147483648, 'totalSizeBytes must be 2147483648 (2 GiB)');
assert.strictEqual(m.integrity.chunksCount, 2048, 'chunksCount must be 2048');

// Verify strict gate
assert.strictEqual(m.validationStatus, 'experimental', 'validationStatus must remain experimental until Phase 6.3/6.4 boot validation');

console.log('✓ Distribution manifest schema and values verified against generated assets');
console.log('✓ Validation gate status confirmed: experimental (safe)');
console.log('ALL MANIFEST INTEGRATION TESTS PASSED CLEANLY.\n');
