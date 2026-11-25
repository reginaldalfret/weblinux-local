/**
 * WebLinux Local — Phase 6.5: Ubuntu 24.04.5 LTS KDE Plasma Disk & Chunk Builder
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const WORKSPACE = path.resolve(__dirname, '../../.phase6-build');
const REPO_ROOT = path.resolve(__dirname, '..');
const CHUNKS_DIR = path.resolve(REPO_ROOT, 'apps/web/public/disk/ubuntu-24.04-kde');
const FS_DIR = path.join(WORKSPACE, 'filesystem');

const CHUNK_SIZE = 1048576; // 1 MiB
const DISK_SIZE_BYTES = 3221225472; // 3 GiB
const BLOCK_SIZE = 4096;
const BLOCKS_COUNT = DISK_SIZE_BYTES / BLOCK_SIZE; // 786432

function run() {
  console.log('=== WebLinux Local - Ubuntu 24.04.5 LTS KDE Plasma Disk & Chunk Builder ===');
  fs.mkdirSync(FS_DIR, { recursive: true });
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });

  const imgPath = path.join(FS_DIR, 'ubuntu-24.04-kde.ext4');
  const wslImgPath = '/mnt/e/Web-Linux/.phase6-build/filesystem/ubuntu-24.04-kde.ext4';
  const wslRootfsPath = '/mnt/e/Web-Linux/.phase6-build/ubuntu-kde/rootfs';

  if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  console.log(`[1/4] Creating ${DISK_SIZE_BYTES} bytes ext4 image...`);
  execSync(`wsl -u root truncate -s ${DISK_SIZE_BYTES} ${wslImgPath}`, { stdio: 'inherit' });

  console.log(`[2/4] Formatting ext4 filesystem with mke2fs...`);
  execSync(
    `wsl -u root mke2fs -t ext4 -b ${BLOCK_SIZE} -I 256 -L "ubuntu-kde" ` +
    `-O has_journal,ext_attr,resize_inode,dir_index,filetype,extent,flex_bg,sparse_super,large_file,huge_file,dir_nlink,extra_isize ` +
    `-m 1 -d ${wslRootfsPath} ${wslImgPath} ${BLOCKS_COUNT}`,
    { stdio: 'inherit' }
  );

  console.log(`[3/4] Verifying filesystem integrity with e2fsck...`);
  execSync(`wsl -u root e2fsck -f -n ${wslImgPath}`, { stdio: 'inherit' });

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
    hashes.push(crypto.createHash('sha256').update(chunk).digest('hex'));
    let nz = false;
    for (let b = 0; b < bytesRead; b++) {
      if (chunk[b] !== 0) { nz = true; break; }
    }
    if (nz) { nonZero.push(i); nonZeroSet.add(i); }
    fs.writeFileSync(path.join(CHUNKS_DIR, String(i).padStart(6, '0')), chunk);
    if ((i + 1) % 500 === 0 || (i + 1) === totalChunks) {
      console.log(`  Processed chunk ${i + 1}/${totalChunks} (non-zero: ${nonZero.length})`);
    }
  }
  fs.closeSync(fd);
  const fullImgSha256 = fullImgHash.digest('hex');

  const words = Math.ceil(totalChunks / 32);
  let presentHex = '';
  for (let w = 0; w < words; w++) {
    let val = 0;
    for (let b = 0; b < 32; b++) {
      if (nonZeroSet.has(w * 32 + b)) val |= (1 << (31 - b));
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
    present: presentHex,
  }, null, 2));

  fs.writeFileSync(path.join(CHUNKS_DIR, 'integrity.json'), JSON.stringify({
    distributionId: 'ubuntu-24.04-kde',
    rootfsFormat: 'ext4',
    imageFilename: 'ubuntu-24.04-kde.ext4',
    imageSize: DISK_SIZE_BYTES,
    chunkSize: CHUNK_SIZE,
    chunkCount: totalChunks,
    nonZeroChunkCount: nonZero.length,
    fullImageSha256: fullImgSha256,
    buildTimestamp: new Date().toISOString(),
  }, null, 2));

  console.log(`\n=== CHUNK GENERATION COMPLETE ===`);
  console.log(`Total chunks: ${totalChunks}, Non-zero: ${nonZero.length}, Boot: ${bootChunks.length}`);
  console.log(`Image SHA-256: ${fullImgSha256}`);
}

if (require.main === module) run();
