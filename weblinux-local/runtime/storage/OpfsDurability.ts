/**
 * WebLinux Local — OPFS Storage Durability, Metadata Journaling & Recovery Codec
 *
 * Implements:
 * - IEEE 802.3 CRC32 for metadata and map integrity verification
 * - Dual-slot (A/B) 64-byte metadata commit headers with generation counters and dirty flags
 * - Deterministic crash recovery selecting the highest valid clean generation
 * - Write-lifecycle state and metrics types
 */

export const OPFS_META_MAGIC = 0x52564d31; // "RVM1"
export const OPFS_META_VERSION = 1;
export const OPFS_META_SLOT_SIZE = 64;
export const OPFS_META_TOTAL_SIZE = OPFS_META_SLOT_SIZE * 2; // 128 bytes (Slot A + Slot B)

export const OPFS_FLAG_DIRTY = 1 << 0;

export type WriteLifecycleStage =
  | 'received'
  | 'queued'
  | 'written_to_opfs'
  | 'flushed'
  | 'acknowledged'
  | 'failed';

export interface DiskDurabilityMetrics {
  diskName: string;
  generation: number;
  writesReceived: number;
  writesCompleted: number;
  flushesCompleted: number;
  flushErrors: number;
  dirtyPieces: number;
  lastFlushAt: number;
  lastError: string | null;
}

export interface MetaSlot {
  magic: number;
  version: number;
  generation: number;
  flags: number;
  places: number;
  mapCrc32: number;
  pieceCount: number;
  pieceSize: number;
  entryCrc32: number;
  valid: boolean;
  dirty: boolean;
}

export interface RecoveryDecision {
  status: 'clean' | 'recovered_rollback' | 'uninitialized' | 'corrupted';
  selectedSlotIndex: 0 | 1 | -1;
  activeGeneration: number;
  places: number;
  mapCrc32: number;
  reason: string;
}

// Precompute IEEE 802.3 CRC32 lookup table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

export function crc32(bytes: Uint8Array, length: number = bytes.byteLength): number {
  let crc = 0xffffffff;
  for (let i = 0; i < length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function encodeMetaSlot(params: {
  generation: number;
  dirty: boolean;
  places: number;
  mapCrc32: number;
  pieceCount: number;
  pieceSize: number;
}): Uint8Array {
  const buf = new Uint8Array(OPFS_META_SLOT_SIZE);
  const view = new DataView(buf.buffer);
  view.setUint32(0, OPFS_META_MAGIC, true);
  view.setUint32(4, OPFS_META_VERSION, true);
  view.setUint32(8, params.generation >>> 0, true);
  view.setUint32(12, params.dirty ? OPFS_FLAG_DIRTY : 0, true);
  view.setUint32(16, params.places >>> 0, true);
  view.setUint32(20, params.mapCrc32 >>> 0, true);
  view.setUint32(24, params.pieceCount >>> 0, true);
  view.setUint32(28, params.pieceSize >>> 0, true);
  const checksum = crc32(buf, 60);
  view.setUint32(60, checksum, true);
  return buf;
}

export function decodeMetaSlot(buf: Uint8Array): MetaSlot {
  if (buf.byteLength < OPFS_META_SLOT_SIZE) {
    return {
      magic: 0,
      version: 0,
      generation: 0,
      flags: 0,
      places: 0,
      mapCrc32: 0,
      pieceCount: 0,
      pieceSize: 0,
      entryCrc32: 0,
      valid: false,
      dirty: false,
    };
  }
  const view = new DataView(buf.buffer, buf.byteOffset, OPFS_META_SLOT_SIZE);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const generation = view.getUint32(8, true);
  const flags = view.getUint32(12, true);
  const places = view.getUint32(16, true);
  const mapCrc32 = view.getUint32(20, true);
  const pieceCount = view.getUint32(24, true);
  const pieceSize = view.getUint32(28, true);
  const entryCrc32 = view.getUint32(60, true);
  const computed = crc32(buf, 60);
  const valid = magic === OPFS_META_MAGIC && version === OPFS_META_VERSION && computed === entryCrc32;

  return {
    magic,
    version,
    generation,
    flags,
    places,
    mapCrc32,
    pieceCount,
    pieceSize,
    entryCrc32,
    valid,
    dirty: (flags & OPFS_FLAG_DIRTY) !== 0,
  };
}

/**
 * Selects the authoritative metadata generation from dual A/B slots.
 * Never picks a dirty or CRC-corrupted slot if a clean prior generation exists.
 */
export function selectRecoverySlot(
  metaBytes: Uint8Array,
  expectedPieceCount: number,
  expectedPieceSize: number
): RecoveryDecision {
  if (metaBytes.byteLength < OPFS_META_TOTAL_SIZE) {
    return {
      status: 'uninitialized',
      selectedSlotIndex: -1,
      activeGeneration: 0,
      places: 0,
      mapCrc32: 0,
      reason: 'Metadata file absent or smaller than dual-slot header',
    };
  }

  const slotA = decodeMetaSlot(metaBytes.subarray(0, OPFS_META_SLOT_SIZE));
  const slotB = decodeMetaSlot(metaBytes.subarray(OPFS_META_SLOT_SIZE, OPFS_META_TOTAL_SIZE));

  const isCompatible = (s: MetaSlot) =>
    s.valid && s.pieceCount === expectedPieceCount && s.pieceSize === expectedPieceSize;

  const cleanCandidates: Array<{ idx: 0 | 1; slot: MetaSlot }> = [];
  if (isCompatible(slotA) && !slotA.dirty) cleanCandidates.push({ idx: 0, slot: slotA });
  if (isCompatible(slotB) && !slotB.dirty) cleanCandidates.push({ idx: 1, slot: slotB });

  if (cleanCandidates.length === 0) {
    const anyDirty = (isCompatible(slotA) && slotA.dirty) || (isCompatible(slotB) && slotB.dirty);
    return {
      status: anyDirty ? 'corrupted' : 'uninitialized',
      selectedSlotIndex: -1,
      activeGeneration: 0,
      places: 0,
      mapCrc32: 0,
      reason: anyDirty
        ? 'Interrupted initial commit detected with no prior clean generation'
        : 'No valid metadata generation found',
    };
  }

  cleanCandidates.sort((a, b) => b.slot.generation - a.slot.generation);
  const winner = cleanCandidates[0];
  const other = winner.idx === 0 ? slotB : slotA;

  const interruptedHigher =
    (other.valid && other.dirty && other.generation >= winner.slot.generation) ||
    (!other.valid && other.magic === OPFS_META_MAGIC);

  return {
    status: interruptedHigher ? 'recovered_rollback' : 'clean',
    selectedSlotIndex: winner.idx,
    activeGeneration: winner.slot.generation,
    places: winner.slot.places,
    mapCrc32: winner.slot.mapCrc32,
    reason: interruptedHigher
      ? `Rolled back interrupted generation to verified clean generation ${winner.slot.generation}`
      : `Verified clean metadata generation ${winner.slot.generation}`,
  };
}
