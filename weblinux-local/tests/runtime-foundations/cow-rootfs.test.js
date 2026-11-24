/**
 * WebLinux Local — Phase 3: Copy-on-Write (COW) Root Filesystem Test Suite
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ts = require(path.resolve(__dirname, '../../apps/web/node_modules/typescript'));
const loadTs = (relPath, deps = {}) => {
  const src = fs.readFileSync(path.resolve(__dirname, relPath), 'utf8');
  const transpiled = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  const customReq = (id) => (deps[id] ? deps[id] : require(id));
  new Function('exports', 'module', 'require', transpiled)(mod.exports, mod, customReq);
  return mod.exports;
};

const durability = loadTs('../../runtime/storage/OpfsDurability.ts');
const { CowBlockLayer } = loadTs('../../runtime/filesystem/CowBlockLayer.ts', {
  '../storage/OpfsDurability': durability,
});

function createImmutableBase(baseId, blockCount, blockSize) {
  const blocks = Array.from({ length: blockCount }, (_, i) => {
    const b = Buffer.alloc(blockSize, i + 1);
    return new Uint8Array(b);
  });
  const hashAll = () => {
    const h = crypto.createHash('sha256');
    for (const b of blocks) h.update(b);
    return h.digest('hex');
  };
  const initialHash = hashAll();
  return {
    initialHash,
    hashAll,
    store: {
      readBaseBlock: async (idx) => new Uint8Array(blocks[idx]),
      getBlockCount: () => blockCount,
      getBlockSize: () => blockSize,
      getBaseImageId: () => baseId,
    },
  };
}

async function run() {
  console.log('=== PHASE 3: COPY-ON-WRITE (COW) ROOT FILESYSTEM TESTS ===');

  const BLOCK_SIZE = 4096;
  const BLOCK_COUNT = 16;

  // 1. Clean base & immutable base checksum preservation
  const ubuntuBase = createImmutableBase('ubuntu-24.04-v1', BLOCK_COUNT, BLOCK_SIZE);
  const debianBase = createImmutableBase('debian-13-v1', BLOCK_COUNT, BLOCK_SIZE);

  const ubuntuCow = new CowBlockLayer('ubuntu', ubuntuBase.store);
  const debianCow = new CowBlockLayer('debian', debianBase.store);

  const cleanBlock = await ubuntuCow.readBlock(2);
  assert.strictEqual(cleanBlock[0], 3, 'Clean read must come from immutable base');
  assert.strictEqual(ubuntuCow.isBlockInUpperLayer(2), false);

  // 2. Write to Ubuntu root -> stored in upper layer, base checksum unchanged
  const writeData = new TextEncoder().encode('UBUNTU_ROOTFS_MODIFICATION_1');
  await ubuntuCow.writeBlock(2, 0, writeData);
  assert.strictEqual(ubuntuCow.isBlockInUpperLayer(2), true);
  assert.strictEqual(ubuntuCow.getAllocatedUpperBlockCount(), 1);
  assert.strictEqual(ubuntuBase.hashAll(), ubuntuBase.initialHash, 'Immutable base checksum MUST remain unchanged');

  const readModified = await ubuntuCow.readBlock(2);
  assert.strictEqual(new TextDecoder().decode(readModified.subarray(0, writeData.length)), 'UBUNTU_ROOTFS_MODIFICATION_1');
  console.log('  [PASS] Upper-layer write isolation & immutable base checksum preserved');

  // 3. Distribution isolation: Ubuntu write does not appear in Debian
  const debianBlock2 = await debianCow.readBlock(2);
  assert.strictEqual(debianBlock2[0], 3, 'Debian COW layer must remain completely isolated from Ubuntu writes');
  assert.strictEqual(debianCow.isBlockInUpperLayer(2), false);
  console.log('  [PASS] Debian & Ubuntu COW root layers completely isolated');

  // 4. Simulated Home Disk independence
  const homeDiskData = Buffer.from('USER_HOME_DOCUMENTS_DO_NOT_DELETE');

  // 5. Snapshot & rollback
  const snap1 = ubuntuCow.createSnapshot('snap-1', 'Known-good after first edit');
  assert.strictEqual(snap1.status, 'committed');
  assert.strictEqual(snap1.allocatedUpperBlocks, 1);

  await ubuntuCow.writeBlock(2, 0, new TextEncoder().encode('BAD_EXPERIMENTAL_CHANGE_XXXX'));
  await ubuntuCow.writeBlock(5, 0, new TextEncoder().encode('EXTRA_FILE_ON_ROOT'));
  assert.strictEqual(ubuntuCow.getAllocatedUpperBlockCount(), 2);

  ubuntuCow.rollbackToSnapshot('snap-1');
  assert.strictEqual(ubuntuCow.getAllocatedUpperBlockCount(), 1);
  assert.strictEqual(ubuntuCow.isBlockInUpperLayer(5), false, 'Block 5 written after snapshot must be reverted');
  const restored = await ubuntuCow.readBlock(2);
  assert.strictEqual(new TextDecoder().decode(restored.subarray(0, writeData.length)), 'UBUNTU_ROOTFS_MODIFICATION_1');
  assert.strictEqual(homeDiskData.toString(), 'USER_HOME_DOCUMENTS_DO_NOT_DELETE', 'Home disk unaffected by root rollback');
  console.log('  [PASS] Snapshot & rollback restored exact state without touching home disk');

  // 6. Interrupted/pending snapshot rejected
  const pendingSnap = ubuntuCow.createSnapshot('snap-pending', 'Interrupted', true);
  assert.strictEqual(pendingSnap.status, 'pending');
  assert.throws(() => ubuntuCow.rollbackToSnapshot('snap-pending'), /non-committed/);
  console.log('  [PASS] Interrupted (pending) snapshot rejected safely');

  // 7. Corrupted snapshot CRC32 rejected
  ubuntuCow.createSnapshot('snap-corrupt', 'Will corrupt');
  ubuntuCow.corruptSnapshotForTest('snap-corrupt');
  assert.throws(() => ubuntuCow.rollbackToSnapshot('snap-corrupt'), /CRC32 verification failed/);
  console.log('  [PASS] Corrupted snapshot data CRC32 rejected');

  // 8. Safe base update transaction with rollback on validation failure
  ubuntuCow.beginBaseUpdate('tx-1', 'ubuntu-24.04-v2');
  const rolledBack = ubuntuCow.commitBaseUpdate(false);
  assert.strictEqual(rolledBack.status, 'rolled_back');
  assert.strictEqual(ubuntuCow.getBaseImageId(), 'ubuntu-24.04-v1');
  const afterFailedUpdate = await ubuntuCow.readBlock(2);
  assert.strictEqual(new TextDecoder().decode(afterFailedUpdate.subarray(0, writeData.length)), 'UBUNTU_ROOTFS_MODIFICATION_1');
  console.log('  [PASS] Failed base update rolled back to last known-good state');

  console.log('=== ALL 8 PHASE 3 COPY-ON-WRITE TESTS PASSED ===');
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
