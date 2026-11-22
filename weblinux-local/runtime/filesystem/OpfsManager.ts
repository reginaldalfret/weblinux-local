/**
 * WebLinux Local - OPFS Persistent Storage Subsystem
 * Manages Origin Private File System handles, quotas, persistence permissions, and backup archives.
 */

import { StorageUsageInfo, ImportResult } from '../types';

export class OpfsManager {
  private static instance: OpfsManager;

  public static getInstance(): OpfsManager {
    if (!OpfsManager.instance) {
      OpfsManager.instance = new OpfsManager();
    }
    return OpfsManager.instance;
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' &&
           !!navigator.storage &&
           typeof navigator.storage.getDirectory === 'function';
  }

  public async requestPersistence(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        return await navigator.storage.persist();
      } catch (err) {
        console.warn('[OPFS] Request persistence failed:', err);
        return false;
      }
    }
    return false;
  }

  public async getStorageUsage(): Promise<StorageUsageInfo> {
    const isSupported = this.isSupported();
    let isPersistentGranted = false;
    let quota = 0;
    let usage = 0;

    if (typeof navigator !== 'undefined' && navigator.storage) {
      try {
        if (navigator.storage.persisted) {
          isPersistentGranted = await navigator.storage.persisted();
        }
        if (navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          quota = estimate.quota || 0;
          usage = estimate.usage || 0;
        }
      } catch (err) {
        console.warn('[OPFS] Storage estimate failed:', err);
      }
    }

    const disks: StorageUsageInfo['disks'] = [];

    if (isSupported) {
      try {
        const root = await navigator.storage.getDirectory();
        // @ts-ignore
        for await (const [name, handle] of root.entries()) {
          if (handle.kind === 'directory' && name.startsWith('disk-')) {
            const diskType = name.includes('home') ? 'home' : name.includes('cache') ? 'cache' : 'system';
            let diskBytes = 0;
            try {
              // @ts-ignore
              for await (const [, fileHandle] of handle.entries()) {
                if (fileHandle.kind === 'file') {
                  const file = await fileHandle.getFile();
                  diskBytes += file.size;
                }
              }
            } catch (fileErr) {
              console.warn(`[OPFS] Could not inspect contents of ${name}:`, fileErr);
            }

            disks.push({
              name,
              type: diskType,
              bytes: diskBytes,
            });
          }
        }
      } catch (err) {
        console.warn('[OPFS] Failed to inspect root OPFS directory:', err);
      }
    }

    // Default disks if none found yet
    if (disks.length === 0) {
      disks.push(
        { name: 'disk-release', type: 'system', bytes: 0 },
        { name: 'disk-home', type: 'home', bytes: 0 },
        { name: 'disk-jitcache', type: 'cache', bytes: 0 }
      );
    }

    const usagePercentage = quota > 0 ? (usage / quota) * 100 : 0;

    return {
      isPersistentGranted,
      quotaBytes: quota,
      usageBytes: usage,
      usagePercentage,
      opfsSupported: isSupported,
      disks,
    };
  }

  public async resetDisk(diskName: string): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const root = await navigator.storage.getDirectory();
      const sanitizedName = diskName.startsWith('disk-') ? diskName : `disk-${diskName}`;
      await root.removeEntry(sanitizedName, { recursive: true });
      return true;
    } catch (err: any) {
      if (err.name === 'NotFoundError') return true;
      console.error(`[OPFS] Failed to remove disk ${diskName}:`, err);
      return false;
    }
  }

  public async resetAll(): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const root = await navigator.storage.getDirectory();
      // @ts-ignore
      for await (const [name] of root.entries()) {
        try {
          await root.removeEntry(name, { recursive: true });
        } catch (err) {
          console.warn(`[OPFS] Could not remove entry ${name}:`, err);
        }
      }
    } catch (err) {
      console.error('[OPFS] Reset all failed:', err);
    }
  }

  public async exportHomeArchive(distroId: string = 'debian'): Promise<Blob> {
    if (!this.isSupported()) {
      throw new Error('OPFS is not supported in this browser environment');
    }

    const root = await navigator.storage.getDirectory();
    const diskDirName = `disk-home-${distroId}`;
    let homeDirHandle: FileSystemDirectoryHandle;
    try {
      homeDirHandle = await root.getDirectoryHandle(diskDirName);
    } catch {
      throw new Error(`Persistent home disk directory "${diskDirName}" does not exist in OPFS. No user data to export.`);
    }

    const filesToExport = ['map', 'data'];
    const filesMetadata: { name: string; size: number; sha256: string; compressedSize: number }[] = [];
    const payloadCompressedB64: Record<string, string> = {};

    for (const filename of filesToExport) {
      let fileHandle: FileSystemFileHandle;
      try {
        fileHandle = await homeDirHandle.getFileHandle(filename);
      } catch {
        throw new Error(`Missing expected disk component "${filename}" in ${diskDirName}.`);
      }

      const file = await fileHandle.getFile();
      const rawBuffer = await file.arrayBuffer();

      // Calculate genuine SHA-256 on uncompressed disk component
      const hashBuffer = await crypto.subtle.digest('SHA-256', rawBuffer);
      const sha256 = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Compress with gzip stream
      let compressedBuffer: ArrayBuffer;
      if (typeof CompressionStream !== 'undefined') {
        const stream = new Blob([rawBuffer]).stream().pipeThrough(new CompressionStream('gzip'));
        compressedBuffer = await new Response(stream).arrayBuffer();
      } else {
        compressedBuffer = rawBuffer;
      }

      // Convert compressed buffer to base64 using chunking for performance
      let binary = '';
      const bytes = new Uint8Array(compressedBuffer);
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
      }
      const b64 = btoa(binary);

      filesMetadata.push({
        name: filename,
        size: rawBuffer.byteLength,
        sha256,
        compressedSize: compressedBuffer.byteLength,
      });

      payloadCompressedB64[filename] = b64;
    }

    const backupArchive = {
      format: 'weblinux-backup',
      version: '2.0',
      distribution: distroId,
      targetDisk: diskDirName,
      timestamp: new Date().toISOString(),
      manifest: {
        totalFiles: filesMetadata.length,
        uncompressedTotalBytes: filesMetadata.reduce((acc, f) => acc + f.size, 0),
        compressedTotalBytes: filesMetadata.reduce((acc, f) => acc + f.compressedSize, 0),
        files: filesMetadata,
      },
      payload: payloadCompressedB64,
    };

    return new Blob([JSON.stringify(backupArchive, null, 2)], { type: 'application/json' });
  }

  public async importHomeArchive(archiveInput: Blob | File | string, distroId: string = 'debian'): Promise<ImportResult> {
    if (!this.isSupported()) {
      return { success: false, importedFilesCount: 0, totalBytes: 0, errors: ['OPFS is not supported in this browser'] };
    }

    try {
      let jsonText: string;
      if (typeof archiveInput === 'string') {
        jsonText = archiveInput;
      } else {
        jsonText = await archiveInput.text();
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonText);
      } catch (err: any) {
        return { success: false, importedFilesCount: 0, totalBytes: 0, errors: [`Corrupted backup: Invalid JSON (${err.message})`] };
      }

      // 1. Validate version and format
      if (parsed.format !== 'weblinux-backup' || !parsed.manifest || !parsed.payload) {
        return { success: false, importedFilesCount: 0, totalBytes: 0, errors: ['Incompatible or unrecognized backup format. Expected "weblinux-backup" v2.0'] };
      }

      const filesMeta = parsed.manifest.files;
      if (!Array.isArray(filesMeta) || filesMeta.length === 0) {
        return { success: false, importedFilesCount: 0, totalBytes: 0, errors: ['Backup archive contains no valid disk components.'] };
      }

      // 2. Pre-flight decompress and verify all SHA-256 checksums BEFORE writing anything to OPFS
      const decompressedComponents: { name: string; bytes: Uint8Array; originalSize: number }[] = [];

      for (const meta of filesMeta) {
        const b64 = parsed.payload[meta.name];
        if (!b64) {
          return { success: false, importedFilesCount: 0, totalBytes: 0, errors: [`Missing payload for required component "${meta.name}"`] };
        }

        let binStr: string;
        try {
          binStr = atob(b64);
        } catch (e: any) {
          return { success: false, importedFilesCount: 0, totalBytes: 0, errors: [`Base64 decoding failed for ${meta.name}: ${e.message}`] };
        }

        const compressedBytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          compressedBytes[i] = binStr.charCodeAt(i);
        }

        let decompressedBuf: ArrayBuffer;
        if (typeof DecompressionStream !== 'undefined') {
          try {
            const stream = new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            decompressedBuf = await new Response(stream).arrayBuffer();
          } catch (decompErr: any) {
            return { success: false, importedFilesCount: 0, totalBytes: 0, errors: [`Decompression failed for ${meta.name}: ${decompErr.message}`] };
          }
        } else {
          decompressedBuf = compressedBytes.buffer;
        }

        // Verify size
        if (decompressedBuf.byteLength !== meta.size) {
          return {
            success: false,
            importedFilesCount: 0,
            totalBytes: 0,
            errors: [`Integrity check failed: ${meta.name} size mismatch (got ${decompressedBuf.byteLength}, expected ${meta.size})`],
          };
        }

        // Verify SHA-256
        const hashBuf = await crypto.subtle.digest('SHA-256', decompressedBuf);
        const actualSha256 = Array.from(new Uint8Array(hashBuf))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        if (actualSha256.toLowerCase() !== meta.sha256.toLowerCase()) {
          return {
            success: false,
            importedFilesCount: 0,
            totalBytes: 0,
            errors: [`Cryptographic integrity verification failed for ${meta.name}. Checksum mismatch: expected ${meta.sha256}, got ${actualSha256}. Restoration aborted without modifying storage.`],
          };
        }

        decompressedComponents.push({
          name: meta.name,
          bytes: new Uint8Array(decompressedBuf),
          originalSize: decompressedBuf.byteLength,
        });
      }

      // 3. All checksums and sizes verified! Now safely write to OPFS
      const root = await navigator.storage.getDirectory();
      const diskDirName = parsed.targetDisk || `disk-home-${distroId}`;
      const homeDirHandle = await root.getDirectoryHandle(diskDirName, { create: true });

      let totalWritten = 0;
      for (const comp of decompressedComponents) {
        const fileHandle = await homeDirHandle.getFileHandle(comp.name, { create: true });
        try {
          const syncHandle = await (fileHandle as any).createSyncAccessHandle?.();
          if (syncHandle) {
            syncHandle.truncate(comp.bytes.byteLength);
            syncHandle.write(comp.bytes, { at: 0 });
            syncHandle.flush();
            syncHandle.close();
          } else {
            const writable = await fileHandle.createWritable();
            await writable.write(comp.bytes);
            await writable.close();
          }
        } catch {
          const writable = await fileHandle.createWritable();
          await writable.write(comp.bytes);
          await writable.close();
        }
        totalWritten += comp.bytes.byteLength;
      }

      return {
        success: true,
        importedFilesCount: decompressedComponents.length,
        totalBytes: totalWritten,
      };

    } catch (err: any) {
      return { success: false, importedFilesCount: 0, totalBytes: 0, errors: [`Restore failed: ${err.message}`] };
    }
  }
}
