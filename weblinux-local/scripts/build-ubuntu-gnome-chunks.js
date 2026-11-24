/**
 * WebLinux Local - Ubuntu 24.04.5 LTS GNOME 46 Rootfs Disk & Chunk Builder
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const WORKSPACE = path.resolve(__dirname, '../../.phase6-build');
const REPO_ROOT = path.resolve(__dirname, '..');
const CHUNKS_DIR = path.resolve(REPO_ROOT, 'apps/web/public/disk/ubuntu-24.04-gnome');
const ROOTFS_DIR = path.join(WORKSPACE, 'ubuntu-gnome/rootfs');
const FS_DIR = path.join(WORKSPACE, 'filesystem');

const CHUNK_SIZE = 1048576; // 1 MiB
const DISK_SIZE_BYTES = 3221225472; // 3 GiB
const BLOCK_SIZE = 4096;
const BLOCKS_COUNT = DISK_SIZE_BYTES / BLOCK_SIZE; // 786432

function run() {
  console.log('=== WebLinux Local - Ubuntu 24.04.5 LTS GNOME 46 Disk & Chunk Builder ===');

  fs.mkdirSync(FS_DIR, { recursive: true });
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });

  const imgPath = path.join(FS_DIR, 'ubuntu-24.04-gnome.ext4');
  const wslImgPath = '/mnt/e/Web-Linux/.phase6-build/filesystem/ubuntu-24.04-gnome.ext4';
  const wslRootfsPath = '/mnt/e/Web-Linux/.phase6-build/ubuntu-gnome/rootfs';

  const skipFormat = process.argv.includes('--skip-format');

  if (!skipFormat) {
    console.log(`[1/4] Truncating ${DISK_SIZE_BYTES} bytes disk image: ${imgPath}...`);
    if (fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
    }
    execSync(`wsl -u root truncate -s ${DISK_SIZE_BYTES} ${wslImgPath}`, { stdio: 'inherit' });

    console.log(`[2/4] Formatting ext4 filesystem with mke2fs...`);
    execSync(
      `wsl -u root mke2fs -t ext4 -b ${BLOCK_SIZE} -I 256 -L "ubuntu-gnome" ` +
      `-O has_journal,ext_attr,resize_inode,dir_index,filetype,extent,flex_bg,sparse_super,large_file,huge_file,dir_nlink,extra_isize ` +
      `-m 1 -d ${wslRootfsPath} ${wslImgPath} ${BLOCKS_COUNT}`,
      { stdio: 'inherit' }
    );
  } else {
    console.log('[1/4 & 2/4] Skipping format as requested (--skip-format).');
  }

  console.log(`[3/4] Verifying filesystem integrity with e2fsck...`);
  execSync(`wsl -u root e2fsck -f -n ${wslImgPath}`, { stdio: 'inherit' });
  console.log('[PASS] ext4 filesystem verified clean.');

  console.log(`[4/4] Slicing into 1 MiB chunks and generating manifest...`);
  const fullImgHash = crypto.createHash('sha256');
  const fd = fs.openSync(imgPath, 'r');
  const totalChunks = Math.ceil(DISK_SIZE_BYTES / CHUNK_SIZE);
  const buf = Buffer.alloc(CHUNK_SIZE);
  const hashes = [];
  const nonZero = [];
  const nonZeroSet = new Set();

  for (let i = 0; i < totalChunks; i++) {
    const bytesRead = fs.readSync(fd, buf, 0, CHUNK_SIZE, i * CHUNK_SIZE);
    const chunk = buf.subarray(0, bytesRead);
    fullImgHash.update(chunk);
    const cHash = crypto.createHash('sha256').update(chunk).digest('hex');
    hashes.push(cHash);
    let nz = false;
    for (let b = 0; b < bytesRead; b++) {
      if (chunk[b] !== 0) { nz = true; break; }
    }
    if (nz) {
      nonZero.push(i);
      nonZeroSet.add(i);
    }
    const fn = String(i).padStart(6, '0');
    fs.writeFileSync(path.join(CHUNKS_DIR, fn), chunk);

    if ((i + 1) % 500 === 0 || (i + 1) === totalChunks) {
      console.log(`  Processed chunk ${i + 1}/${totalChunks} (non-zero so far: ${nonZero.length})`);
    }
  }
  fs.closeSync(fd);
  const fullImgSha256 = fullImgHash.digest('hex');

  // Generate present hex bitmap (32 chunks per word, MSB first)
  const words = Math.ceil(totalChunks / 32);
  let presentHex = '';
  for (let w = 0; w < words; w++) {
    let val = 0;
    for (let b = 0; b < 32; b++) {
      const idx = w * 32 + b;
      if (nonZeroSet.has(idx)) {
        val |= (1 << (31 - b));
      }
    }
    presentHex += (val >>> 0).toString(16).padStart(8, '0');
  }

  const bootChunks = nonZero.filter(i => i < 64);

  fs.writeFileSync(path.join(CHUNKS_DIR, 'manifest.json'), JSON.stringify({
    size: DISK_SIZE_BYTES,
    piece: CHUNK_SIZE,
    id: fullImgSha256.substring(0, 32),
    hashes,
    boot: bootChunks,
    present: presentHex
  }, null, 2));

  fs.writeFileSync(path.join(CHUNKS_DIR, 'integrity.json'), JSON.stringify({
    distributionId: 'ubuntu-24.04-gnome',
    rootfsFormat: 'ext4',
    imageFilename: 'ubuntu-24.04-gnome.ext4',
    imageSize: DISK_SIZE_BYTES,
    chunkSize: CHUNK_SIZE,
    chunkCount: totalChunks,
    nonZeroChunkCount: nonZero.length,
    fullImageSha256: fullImgSha256,
    buildTimestamp: new Date().toISOString()
  }, null, 2));

  console.log('\n=== CHUNK GENERATION COMPLETE ===');
  console.log(`Total chunks: ${totalChunks}`);
  console.log(`Non-zero chunks: ${nonZero.length}`);
  console.log(`Boot chunks count: ${bootChunks.length}`);
  console.log(`Present bitmap length: ${presentHex.length} hex chars`);
  console.log(`Image SHA-256: ${fullImgSha256}`);
}

if (require.main === module) {
  run();
}