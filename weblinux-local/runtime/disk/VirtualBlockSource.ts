/**
 * WebLinux Local — VirtualBlockSource Abstraction, ChunkBlockSource & RangeBlockSource
 *
 * Provides a unified block-reading interface with:
 * - Real HTTP 206 Partial Content probing (never trusting Accept-Ranges alone)
 * - Content-Range, Content-Length, and ETag entity validation
 * - Bounded LRU block cache (default max 32 MiB) and in-flight request deduplication
 * - Bounded request concurrency (<= 4)
 * - Automatic fallback to ChunkBlockSource when Range is unsupported or returns 200 OK
 */

export interface BlockSourceStats {
  sourceType: 'chunk' | 'range' | 'range+chunk-fallback';
  requestsIssued: number;
  cacheHits: number;
  dedupHits: number;
  bytesTransferred: number;
  fallbackCount: number;
  etag: string | null;
}

export interface VirtualBlockSource {
  read(offset: number, length: number): Promise<Uint8Array>;
  size(): Promise<number>;
  verify(): Promise<void>;
  close(): Promise<void>;
  getStats(): BlockSourceStats;
}

export interface BlockSourceOptions {
  blockSize?: number; // Default 1 MiB (1048576)
  maxCacheBlocks?: number; // Default 32 (32 MiB bounded cache)
  maxConcurrency?: number; // Default 4
  expectedSha256?: string;
  fetchImpl?: typeof fetch;
}

export class ChunkBlockSource implements VirtualBlockSource {
  private readonly baseUrl: string;
  private readonly totalSize: number;
  private readonly blockSize: number;
  private readonly maxCacheBlocks: number;
  private readonly fetchFn: typeof fetch;
  private readonly cache = new Map<number, Uint8Array>();
  private readonly inFlight = new Map<number, Promise<Uint8Array>>();
  private readonly present?: Uint8Array;
  private stats: BlockSourceStats = {
    sourceType: 'chunk',
    requestsIssued: 0,
    cacheHits: 0,
    dedupHits: 0,
    bytesTransferred: 0,
    fallbackCount: 0,
    etag: null,
  };

  constructor(baseUrl: string, totalSize: number, opts: BlockSourceOptions & { present?: Uint8Array } = {}) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    this.totalSize = totalSize;
    this.blockSize = opts.blockSize || 1048576;
    this.maxCacheBlocks = Math.min(64, opts.maxCacheBlocks || 32);
    this.fetchFn = opts.fetchImpl || fetch.bind(globalThis);
    this.present = opts.present;
  }

  public async size(): Promise<number> {
    return this.totalSize;
  }

  public async verify(): Promise<void> {
    const res = await this.fetchFn(this.baseUrl + 'manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Chunk manifest check failed: HTTP ${res.status}`);
  }

  private async fetchBlock(blockIdx: number): Promise<Uint8Array> {
    if (this.present && this.present[blockIdx] === 0) {
      return new Uint8Array(Math.min(this.blockSize, this.totalSize - blockIdx * this.blockSize));
    }
    const cached = this.cache.get(blockIdx);
    if (cached) {
      this.stats.cacheHits++;
      this.cache.delete(blockIdx);
      this.cache.set(blockIdx, cached);
      return cached;
    }
    const existing = this.inFlight.get(blockIdx);
    if (existing) {
      this.stats.dedupHits++;
      return existing;
    }
    const p = (async () => {
      const fn = String(blockIdx).padStart(6, '0');
      this.stats.requestsIssued++;
      const res = await this.fetchFn(this.baseUrl + fn);
      if (!res.ok) throw new Error(`Chunk ${fn} fetch failed: HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      this.stats.bytesTransferred += buf.byteLength;
      if (this.cache.size >= this.maxCacheBlocks) {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) this.cache.delete(oldest);
      }
      this.cache.set(blockIdx, buf);
      return buf;
    })().finally(() => this.inFlight.delete(blockIdx));

    this.inFlight.set(blockIdx, p);
    return p;
  }

  public async read(offset: number, length: number): Promise<Uint8Array> {
    if (offset < 0 || length < 0 || offset + length > this.totalSize) {
      throw new RangeError(`Out-of-bounds read: offset=${offset}, length=${length}, size=${this.totalSize}`);
    }
    const out = new Uint8Array(length);
    let pos = 0;
    while (pos < length) {
      const curOffset = offset + pos;
      const blockIdx = Math.floor(curOffset / this.blockSize);
      const within = curOffset - blockIdx * this.blockSize;
      const take = Math.min(length - pos, this.blockSize - within);
      const block = await this.fetchBlock(blockIdx);
      out.set(block.subarray(within, within + take), pos);
      pos += take;
    }
    return out;
  }

  public async close(): Promise<void> {
    this.cache.clear();
    this.inFlight.clear();
  }

  public getStats(): BlockSourceStats {
    return { ...this.stats };
  }
}

export class RangeBlockSource implements VirtualBlockSource {
  private readonly imageUrl: string;
  private readonly totalSize: number;
  private readonly blockSize: number;
  private readonly maxCacheBlocks: number;
  private readonly maxConcurrency: number;
  private readonly fetchFn: typeof fetch;
  private readonly fallback?: ChunkBlockSource;
  private readonly cache = new Map<number, Uint8Array>();
  private readonly inFlight = new Map<number, Promise<Uint8Array>>();
  private activeRequests = 0;
  private waitQueue: Array<() => void> = [];
  private rangeVerified = false;
  private rangeSupported = false;
  private lockedEtag: string | null = null;

  private stats: BlockSourceStats = {
    sourceType: 'range',
    requestsIssued: 0,
    cacheHits: 0,
    dedupHits: 0,
    bytesTransferred: 0,
    fallbackCount: 0,
    etag: null,
  };

  constructor(
    imageUrl: string,
    totalSize: number,
    opts: BlockSourceOptions & { fallbackChunkSource?: ChunkBlockSource } = {}
  ) {
    this.imageUrl = imageUrl;
    this.totalSize = totalSize;
    this.blockSize = opts.blockSize || 1048576;
    this.maxCacheBlocks = Math.min(64, opts.maxCacheBlocks || 32);
    this.maxConcurrency = Math.min(4, Math.max(1, opts.maxConcurrency || 4));
    this.fetchFn = opts.fetchImpl || fetch.bind(globalThis);
    this.fallback = opts.fallbackChunkSource;
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeRequests < this.maxConcurrency) {
      this.activeRequests++;
      return;
    }
    await new Promise<void>((resolve) => this.waitQueue.push(resolve));
    this.activeRequests++;
  }

  private releaseSlot(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    const next = this.waitQueue.shift();
    if (next) next();
  }

  public async size(): Promise<number> {
    return this.totalSize;
  }

  /**
   * Performs a real 512-byte Range probe (never trusts Accept-Ranges alone).
   * Rejects 200 OK full-body responses and validates Content-Range bounds.
   */
  public async verify(): Promise<void> {
    const probeEnd = Math.min(511, this.totalSize - 1);
    const expectedLen = probeEnd + 1;
    const res = await this.fetchFn(this.imageUrl, {
      headers: { Range: `bytes=0-${probeEnd}` },
      cache: 'no-store',
    });

    if (res.status === 200) {
      this.rangeSupported = false;
      this.rangeVerified = true;
      if (!this.fallback) {
        throw new Error('Server ignored Range header (returned 200 OK) and no chunk fallback is configured');
      }
      this.stats.sourceType = 'range+chunk-fallback';
      return;
    }

    if (res.status !== 206) {
      throw new Error(`Range probe failed with HTTP ${res.status}`);
    }

    const contentRange = res.headers.get('Content-Range') || '';
    const match = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i.exec(contentRange.trim());
    if (!match || Number(match[1]) !== 0 || Number(match[2]) !== probeEnd || (match[3] !== '*' && Number(match[3]) !== this.totalSize)) {
      throw new Error(`Invalid Content-Range header on probe: "${contentRange}"`);
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength !== expectedLen) {
      throw new Error(`Range probe length mismatch: expected ${expectedLen}, got ${buf.byteLength}`);
    }

    this.lockedEtag = res.headers.get('ETag');
    this.stats.etag = this.lockedEtag;
    this.rangeSupported = true;
    this.rangeVerified = true;
  }

  private async fetchRangeBlock(blockIdx: number): Promise<Uint8Array> {
    const cached = this.cache.get(blockIdx);
    if (cached) {
      this.stats.cacheHits++;
      this.cache.delete(blockIdx);
      this.cache.set(blockIdx, cached);
      return cached;
    }

    const existing = this.inFlight.get(blockIdx);
    if (existing) {
      this.stats.dedupHits++;
      return existing;
    }

    const p = (async () => {
      if (!this.rangeVerified) {
        await this.verify();
      }
      if (!this.rangeSupported) {
        if (!this.fallback) throw new Error('HTTP Range unsupported');
        this.stats.fallbackCount++;
        return this.fallback.read(blockIdx * this.blockSize, Math.min(this.blockSize, this.totalSize - blockIdx * this.blockSize));
      }

      const start = blockIdx * this.blockSize;
      const end = Math.min(this.totalSize - 1, start + this.blockSize - 1);
      const expectedLen = end - start + 1;

      await this.acquireSlot();
      try {
        this.stats.requestsIssued++;
        const headers: Record<string, string> = { Range: `bytes=${start}-${end}` };
        const res = await this.fetchFn(this.imageUrl, { headers });

        if (res.status === 200 || res.status === 416) {
          this.rangeSupported = false;
          this.stats.sourceType = 'range+chunk-fallback';
          if (this.fallback) {
            this.stats.fallbackCount++;
            return this.fallback.read(start, expectedLen);
          }
          throw new Error(`Range request failed with HTTP ${res.status}`);
        }
        if (res.status !== 206) {
          throw new Error(`Expected HTTP 206 Partial Content, got ${res.status}`);
        }

        const respEtag = res.headers.get('ETag');
        if (this.lockedEtag && respEtag && respEtag !== this.lockedEtag) {
          this.cache.clear();
          throw new Error(`Image ETag changed mid-session (${this.lockedEtag} -> ${respEtag}); cache invalidated`);
        }

        const contentRange = res.headers.get('Content-Range') || '';
        const match = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i.exec(contentRange.trim());
        if (!match || Number(match[1]) !== start || Number(match[2]) !== end) {
          throw new Error(`Mismatched Content-Range: expected ${start}-${end}, got "${contentRange}"`);
        }

        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength !== expectedLen) {
          throw new Error(`Truncated Range response: expected ${expectedLen} bytes, got ${buf.byteLength}`);
        }

        this.stats.bytesTransferred += buf.byteLength;
        if (this.cache.size >= this.maxCacheBlocks) {
          const oldest = this.cache.keys().next().value;
          if (oldest !== undefined) this.cache.delete(oldest);
        }
        this.cache.set(blockIdx, buf);
        return buf;
      } finally {
        this.releaseSlot();
      }
    })().finally(() => this.inFlight.delete(blockIdx));

    this.inFlight.set(blockIdx, p);
    return p;
  }

  public async read(offset: number, length: number): Promise<Uint8Array> {
    if (offset < 0 || length < 0 || offset + length > this.totalSize) {
      throw new RangeError(`Out-of-bounds read: offset=${offset}, length=${length}, size=${this.totalSize}`);
    }
    const out = new Uint8Array(length);
    let pos = 0;
    while (pos < length) {
      const curOffset = offset + pos;
      const blockIdx = Math.floor(curOffset / this.blockSize);
      const within = curOffset - blockIdx * this.blockSize;
      const take = Math.min(length - pos, this.blockSize - within);
      const block = await this.fetchRangeBlock(blockIdx);
      out.set(block.subarray(within, within + take), pos);
      pos += take;
    }
    return out;
  }

  public async close(): Promise<void> {
    this.cache.clear();
    this.inFlight.clear();
    if (this.fallback) await this.fallback.close();
  }

  public getStats(): BlockSourceStats {
    return { ...this.stats };
  }
}
