const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const CHUNKS_DIR = path.resolve(__dirname, '../../../apps/web/public/disk/ubuntu-24.04');
const ORIG_SHA_FILE = path.resolve(__dirname, '../../../../.phase6-build/filesystem/ubuntu-24.04.ext4.sha256');

console.log('--- TEST: Byte-for-Byte Reconstruction & Full-Image Integrity ---');

assert.ok(fs.existsSync(ORIG_SHA_FILE), 'Original SHA-256 file must exist');
const expectedFullSha256 = fs.readFileSync(ORIG_SHA_FILE, 'utf8').trim().split(/\s+/)[0];

const manifest = JSON.parse(fs.readFileSync(path.join(CHUNKS_DIR, 'manifest.json'), 'utf8'));
const totalChunks = manifest.hashes.length;
const pieceSize = manifest.piece;

const fullHash = crypto.createHash('sha256');
let totalBytes = 0;

for (let i = 0; i < totalChunks; i++) {
  const fileName = String(i).padStart(6, '0');
  const filePath = path.join(CHUNKS_DIR, fileName);
  const chunkBuf = fs.readFileSync(filePath);
  fullHash.update(chunkBuf);
  totalBytes += chunkBuf.length;
}

const computedSha256 = fullHash.digest('hex');

console.log(`Reconstructed Total Bytes: ${totalBytes}`);
console.log(`Computed SHA-256:          ${computedSha256}`);
console.log(`Expected Source SHA-256:   ${expectedFullSha256}`);

assert.strictEqual(totalBytes, 2147483648, 'Reconstructed bytes must equal 2147483648 (2 GiB)');
assert.strictEqual(computedSha256.toLowerCase(), expectedFullSha256.toLowerCase(), 'Reconstructed SHA-256 must match source disk image SHA-256');

console.log('✓ Byte-for-byte image equality certified across all 2048 chunks');
console.log('ALL RECONSTRUCTION TESTS PASSED CLEANLY.\n');
