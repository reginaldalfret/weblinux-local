/**
 * WebLinux Local — Phase 2: Consolidated HTTP Range Disk Image Builder
 *
 * Reconstructs `apps/web/public/disk/ubuntu-24.04/rootfs.img` byte-for-byte from the
 * existing 2,048 verified 1 MiB chunks, validates full-image SHA-256 equality,
 * and adds `rangeImage` metadata to `manifest.json` without removing any chunk files.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DISK_DIR = path.resolve(__dirname, '../apps/web/public/disk/ubuntu-24.04');
const MANIFEST_PATH = path.join(DISK_DIR, 'manifest.json');
const INTEGRITY_PATH = path.join(DISK_DIR, 'integrity.json');
const OUTPUT_IMG = path.join(DISK_DIR, 'rootfs.img');

function run() {
  console.log('=== PHASE 2: CONSOLIDATED RANGE IMAGE BUILDER ===');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const integrity = JSON.parse(fs.readFileSync(INTEGRITY_PATH, 'utf8'));
  const totalChunks = manifest.hashes.length;

  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(OUTPUT_IMG, 'w');
  let totalBytes = 0;

  for (let i = 0; i < totalChunks; i++) {
    const fn = String(i).padStart(6, '0');
    const chunkPath = path.join(DISK_DIR, fn);
    const buf = fs.readFileSync(chunkPath);
    hash.update(buf);
    fs.writeSync(fd, buf, 0, buf.byteLength, totalBytes);
    totalBytes += buf.byteLength;
  }
  fs.closeSync(fd);

  const actualSha256 = hash.digest('hex');
  console.log(`Reconstructed Bytes: ${totalBytes}`);
  console.log(`Actual SHA-256:      ${actualSha256}`);
  console.log(`Expected SHA-256:    ${integrity.fullImageSha256}`);

  if (totalBytes !== manifest.size || actualSha256 !== integrity.fullImageSha256) {
    throw new Error('Consolidated rootfs.img verification failed!');
  }

  manifest.rangeImage = {
    url: 'rootfs.img',
    size: totalBytes,
    sha256: actualSha256,
    version: manifest.id,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log('[PASS] Consolidated rootfs.img verified and manifest.json updated.');
}

if (require.main === module) run();
