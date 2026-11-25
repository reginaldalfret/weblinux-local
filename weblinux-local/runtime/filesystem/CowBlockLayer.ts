/**
 * WebLinux Local — Phase 3: Block-Level Copy-on-Write (COW) Root Filesystem Layer
 *
 * Selected over Option A (Native OverlayFS) because `vmlinux-wasm64_nommu.wasm`
 * does not export `overlayfs` (`ovl_*`).
 *
 * Architecture:
 * - Immutable Base Source: Read-only distribution image (never mutated by guest writes)
 * - Writable Upper Layer: Stores only modified blocks + allocation map + CRC32 metadata
 * - Isolated Per-Distribution Identity: e.g., `root-debian-kde-plasma`, `root-ubuntu-cli`, `root-ubuntu-gnome`
 * - Completely separate from `home-<distro>` (root rollback never touches user home files)
 * - Materialized Snapshots: Copies upper-layer block mapping & dirty blocks so rollback is exact
 */

import { crc32 } from '../storage/OpfsDurability';

export interface CowSnapshotMetadata {
  snapshotId: string;
  label: string;
  distroId: string;
  baseImageId: string;
  blockCount: number;
  blockSize: number;
  allocatedUpperBlocks: number;
  mapCrc32: number;
  dataCrc32: number;
  status: 'pending' | 'committed' | 'abandoned';
  createdAt: string;
}

export interface CowUpdateTransaction {
  txId: string;
  fromBaseId: string;
  toBaseId: string;
  status: 'preparing' | 'validated' | 'committed' | 'rolled_back';
  previousSnapshotId: string;
}

export interface CowBackingStore {
  readBaseBlock(blockIdx: number): Promise<Uint8Array>;
  getBlockCount(): number;
  getBlockSize(): number;
  getBaseImageId(): string;
}

export class CowBlockLayer {
  private readonly distroId: string;
  private readonly baseStore: CowBackingStore;
  private readonly blockCount: number;
  private readonly blockSize: number;

  // Active writable upper layer: blockIdx -> slotIdx + 1 (0 = read from immutable base)
  private upperMap: Uint32Array;
  private upperBlocks: Uint8Array[] = [];
  private snapshots = new Map<string, { meta: CowSnapshotMetadata; mapCopy: Uint32Array; blocksCopy: Uint8Array[] }>();
  private activeUpdateTx: CowUpdateTransaction | null = null;
  private activeBaseId: string;

  constructor(distroId: string, baseStore: CowBackingStore) {
    this.distroId = distroId;
    this.baseStore = baseStore;
    this.blockCount = baseStore.getBlockCount();
    this.blockSize = baseStore.getBlockSize();
    this.activeBaseId = baseStore.getBaseImageId();
    this.upperMap = new Uint32Array(this.blockCount);
  }

  public getBaseImageId(): string {
    return this.activeBaseId;
  }

  public getAllocatedUpperBlockCount(): number {
    return this.upperBlocks.length;
  }

  public isBlockInUpperLayer(blockIdx: number): boolean {
    return blockIdx >= 0 && blockIdx < this.blockCount && this.upperMap[blockIdx] > 0;
  }

  /**
   * Reads a block from the writable upper layer if modified, otherwise from the immutable base.
   */
  public async readBlock(blockIdx: number): Promise<Uint8Array> {
    if (blockIdx < 0 || blockIdx >= this.blockCount) {
      throw new RangeError(`COW readBlock out of bounds: ${blockIdx}`);
    }
    const slot = this.upperMap[blockIdx];
    if (slot > 0) {
      return new Uint8Array(this.upperBlocks[slot - 1]);
    }
    return this.baseStore.readBaseBlock(blockIdx);
  }

  /**
   * Copy-on-Write: never mutates `baseStore`. Copies base block into upper layer on first write.
   */
  public async writeBlock(blockIdx: number, offsetWithinBlock: number, data: Uint8Array): Promise<void> {
    if (blockIdx < 0 || blockIdx >= this.blockCount) {
      throw new RangeError(`COW writeBlock out of bounds: ${blockIdx}`);
    }
    if (offsetWithinBlock < 0 || offsetWithinBlock + data.byteLength > this.blockSize) {
      throw new RangeError(`COW write exceeds block boundary`);
    }

    let slot = this.upperMap[blockIdx];
    if (slot === 0) {
      const baseCopy = new Uint8Array(await this.baseStore.readBaseBlock(blockIdx));
      this.upperBlocks.push(baseCopy);
      slot = this.upperBlocks.length;
      this.upperMap[blockIdx] = slot;
    }
    this.upperBlocks[slot - 1].set(data, offsetWithinBlock);
  }

  /**
   * Creates a verified materialized snapshot of the upper layer (does not touch home disk).
   */
  public createSnapshot(snapshotId: string, label: string, simulateInterrupt: boolean = false): CowSnapshotMetadata {
    const mapCopy = new Uint32Array(this.upperMap);
    const blocksCopy = this.upperBlocks.map((b) => new Uint8Array(b));
    const mapBytes = new Uint8Array(mapCopy.buffer, mapCopy.byteOffset, mapCopy.byteLength);
    const mapCrc32 = crc32(mapBytes);

    let combinedCrc = 0;
    for (const blk of blocksCopy) {
      combinedCrc = (combinedCrc ^ crc32(blk)) >>> 0;
    }

    const meta: CowSnapshotMetadata = {
      snapshotId,
      label,
      distroId: this.distroId,
      baseImageId: this.activeBaseId,
      blockCount: this.blockCount,
      blockSize: this.blockSize,
      allocatedUpperBlocks: blocksCopy.length,
      mapCrc32,
      dataCrc32: combinedCrc,
      status: simulateInterrupt ? 'pending' : 'committed',
      createdAt: new Date().toISOString(),
    };

    this.snapshots.set(snapshotId, { meta, mapCopy, blocksCopy });
    return { ...meta };
  }

  /**
   * Rolls back the root upper layer to a committed, CRC-verified snapshot.
   * Rejects pending/interrupted, corrupted, or base-mismatched snapshots.
   */
  public rollbackToSnapshot(snapshotId: string): void {
    const snap = this.snapshots.get(snapshotId);
    if (!snap) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    if (snap.meta.status !== 'committed') {
      throw new Error(`Cannot rollback to non-committed snapshot ${snapshotId} (status: ${snap.meta.status})`);
    }
    if (snap.meta.distroId !== this.distroId || snap.meta.baseImageId !== this.activeBaseId) {
      throw new Error(`Snapshot ${snapshotId} incompatible with distro=${this.distroId}, base=${this.activeBaseId}`);
    }
    const mapBytes = new Uint8Array(snap.mapCopy.buffer, snap.mapCopy.byteOffset, snap.mapCopy.byteLength);
    if (crc32(mapBytes) !== snap.meta.mapCrc32) {
      throw new Error(`Snapshot ${snapshotId} metadata map CRC32 verification failed`);
    }

    let combinedCrc = 0;
    for (const blk of snap.blocksCopy) {
      combinedCrc = (combinedCrc ^ crc32(blk)) >>> 0;
    }
    if (combinedCrc !== snap.meta.dataCrc32) {
      throw new Error(`Snapshot ${snapshotId} block data CRC32 verification failed`);
    }

    this.upperMap = new Uint32Array(snap.mapCopy);
    this.upperBlocks = snap.blocksCopy.map((b) => new Uint8Array(b));
  }

  /**
   * Safe distribution base update transaction: snapshots current state before switching base ID,
   * allowing deterministic rollback if the new base fails validation.
   */
  public beginBaseUpdate(txId: string, newBaseId: string): CowUpdateTransaction {
    const prevSnapId = `pre-update-${txId}`;
    this.createSnapshot(prevSnapId, `Pre-update backup (${this.activeBaseId})`);
    this.activeUpdateTx = {
      txId,
      fromBaseId: this.activeBaseId,
      toBaseId: newBaseId,
      status: 'preparing',
      previousSnapshotId: prevSnapId,
    };
    return { ...this.activeUpdateTx };
  }

  public commitBaseUpdate(newBaseValid: boolean): CowUpdateTransaction {
    if (!this.activeUpdateTx) {
      throw new Error('No active COW base update transaction');
    }
    if (!newBaseValid) {
      this.rollbackToSnapshot(this.activeUpdateTx.previousSnapshotId);
      this.activeUpdateTx.status = 'rolled_back';
      const res = { ...this.activeUpdateTx };
      this.activeUpdateTx = null;
      return res;
    }
    this.activeBaseId = this.activeUpdateTx.toBaseId;
    this.upperMap.fill(0);
    this.upperBlocks = [];
    this.activeUpdateTx.status = 'committed';
    const res = { ...this.activeUpdateTx };
    this.activeUpdateTx = null;
    return res;
  }

  public corruptSnapshotForTest(snapshotId: string): void {
    const snap = this.snapshots.get(snapshotId);
    if (snap && snap.blocksCopy.length > 0) {
      snap.blocksCopy[0][0] ^= 0xff;
    }
  }
}
