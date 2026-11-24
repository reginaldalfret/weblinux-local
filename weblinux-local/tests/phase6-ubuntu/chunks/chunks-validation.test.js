const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const CHUNKS_DIR = path.resolve(__dirname, '../../../apps/web/public/disk/ubuntu-24.04');
const manifestPath = path.join(CHUNKS_DIR, 'manifest.json');

console.log('--- TEST: Chunks Generation & Cryptographic Verification ---');

assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in chunks directory');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const totalChunks = manifest.hashes.length;
const pieceSize = manifest.piece;
assert.strictEqual(pieceSize, 1048576, 'Chunk piece size must be 1048576 (1 MiB)');
assert.strictEqual(totalChunks, 2048, 'Total chunks count must be exactly 2048 for 2 GiB image');
assert.ok(Array.isArray(manifest.boot) && manifest.boot.length > 0, 'boot list must be populated');

console.log(`Verifying ${totalChunks} chunk files on disk...`);

for (let i = 0; i < totalChunks; i++) {
  const fileName = String(i).padStart(6, '0');
  const filePath = path.join(CHUNKS_DIR, fileName);
  assert.ok(fs.existsSync(filePath), `Chunk file ${fileName} must exist`);

  const stat = fs.statSync(filePath);
  assert.strictEqual(stat.size, pieceSize, `Chunk file ${fileName} size must be exactly ${pieceSize} bytes`);

  const buf = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  assert.strictEqual(hash.toLowerCase(), manifest.hashes[i].toLowerCase(), `SHA-256 mismatch for chunk ${fileName}`);
}

console.log(`✓ All ${totalChunks} chunks present, correct size (1048576 bytes), and matching SHA-256 digests`);
console.log(`✓ Boot prefetch list verified: ${manifest.boot.length} chunks mapped`);
console.log('ALL CHUNK VALIDATION TESTS PASSED CLEANLY.\n');
