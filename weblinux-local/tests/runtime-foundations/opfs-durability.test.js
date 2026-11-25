/**
 * WebLinux Local — Phase 1: OPFS Durability, Metadata Journaling & Recovery Unit Tests
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Load TypeScript module via lightweight transpile or inline check against compiled/ts source
const ts = require(path.resolve(__dirname, '../../apps/web/node_modules/typescript'));
const srcPath = path.resolve(__dirname, '../../runtime/storage/OpfsDurability.ts');
const src = fs.readFileSync(srcPath, 'utf8');
const transpiled = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', transpiled)(mod.exports, mod);
const {
  OPFS_META_MAGIC,
  OPFS_META_SLOT_SIZE,
  OPFS_META_TOTAL_SIZE,
  crc32,
  encodeMetaSlot,
  decodeMetaSlot,
  selectRecoverySlot,
} = mod.exports;

console.log('=== PHASE 1: OPFS DURABILITY & RECOVERY UNIT TESTS ===');

// 1. CRC32 standard test vector ("123456789" -> 0xCBF43926)
const vec = new TextEncoder().encode('123456789');
assert.strictEqual(crc32(vec), 0xcbf43926, 'CRC32 must match IEEE 802.3 standard vector');
console.log('  [PASS] IEEE 802.3 CRC32 verification');

// 2. Encode & decode clean metadata slot
const slot0 = encodeMetaSlot({ generation: 1, dirty: false, places: 42, mapCrc32: 0xdeadbeef, pieceCount: 2048, pieceSize: 1048576 });
assert.strictEqual(slot0.byteLength, OPFS_META_SLOT_SIZE);
const dec0 = decodeMetaSlot(slot0);
assert.strictEqual(dec0.valid, true);
assert.strictEqual(dec0.dirty, false);
assert.strictEqual(dec0.magic, OPFS_META_MAGIC);
assert.strictEqual(dec0.generation, 1);
assert.strictEqual(dec0.places, 42);
assert.strictEqual(dec0.mapCrc32, 0xdeadbeef);
console.log('  [PASS] Metadata slot encode/decode and CRC integrity');

// 3. Corrupted metadata detection (flip 1 bit)
const corrupted = new Uint8Array(slot0);
corrupted[17] ^= 0x01;
const decCorrupt = decodeMetaSlot(corrupted);
assert.strictEqual(decCorrupt.valid, false, 'Single-bit flip must invalidate slot CRC');
console.log('  [PASS] Corrupted metadata bit-flip detected');

// 4. Dual-slot clean progression (Gen 1 in Slot A, Gen 2 in Slot B -> selects Gen 2)
const metaBuf = new Uint8Array(OPFS_META_TOTAL_SIZE);
metaBuf.set(encodeMetaSlot({ generation: 1, dirty: false, places: 10, mapCrc32: 0x11111111, pieceCount: 2048, pieceSize: 1048576 }), 0);
metaBuf.set(encodeMetaSlot({ generation: 2, dirty: false, places: 15, mapCrc32: 0x22222222, pieceCount: 2048, pieceSize: 1048576 }), 64);
let decision = selectRecoverySlot(metaBuf, 2048, 1048576);
assert.strictEqual(decision.status, 'clean');
assert.strictEqual(decision.selectedSlotIndex, 1);
assert.strictEqual(decision.activeGeneration, 2);
assert.strictEqual(decision.places, 15);
console.log('  [PASS] Dual-slot clean generation selection (Gen 2 > Gen 1)');

// 5. Interrupted commit rollback (Gen 2 clean in Slot B, Gen 3 DIRTY in Slot A -> rolls back to Gen 2)
metaBuf.set(encodeMetaSlot({ generation: 3, dirty: true, places: 20, mapCrc32: 0x33333333, pieceCount: 2048, pieceSize: 1048576 }), 0);
decision = selectRecoverySlot(metaBuf, 2048, 1048576);
assert.strictEqual(decision.status, 'recovered_rollback');
assert.strictEqual(decision.selectedSlotIndex, 1);
assert.strictEqual(decision.activeGeneration, 2);
assert.strictEqual(decision.places, 15);
console.log('  [PASS] Interrupted commit (dirty Gen 3) rolled back safely to clean Gen 2');

// 6. Corrupted Slot A + Clean Slot B -> recovers Slot B
metaBuf.set(corrupted, 0);
decision = selectRecoverySlot(metaBuf, 2048, 1048576);
assert.strictEqual(decision.status, 'recovered_rollback');
assert.strictEqual(decision.selectedSlotIndex, 1);
assert.strictEqual(decision.activeGeneration, 2);
console.log('  [PASS] Corrupted Slot A rolled back safely to clean Slot B');

// 7. Piece geometry mismatch rejection
decision = selectRecoverySlot(metaBuf, 3072, 1048576);
assert.strictEqual(decision.status, 'uninitialized');
console.log('  [PASS] Incompatible pieceCount/pieceSize rejected');

console.log('=== ALL 7 OPFS DURABILITY UNIT TESTS PASSED ===');
