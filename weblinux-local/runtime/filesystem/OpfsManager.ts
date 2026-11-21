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

  public async exportHomeArchive(): Promise<Blob> {
    const backupMetadata = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      source: 'WebLinux Local OPFS Subsystem',
      files: [] as { name: string; size: number }[],
    };

    const filesContent: Record<string, Uint8Array> = {};

    if (this.isSupported()) {
      try {
        const root = await navigator.storage.getDirectory();
        let homeHandle: FileSystemDirectoryHandle | null = null;
        try {
          homeHandle = await root.getDirectoryHandle('disk-home');
        } catch {
          // May be named disk-home-home or similar
        }

        if (homeHandle) {
          // @ts-ignore
          for await (const [name, handle] of homeHandle.entries()) {
            if (handle.kind === 'file') {
              const file = await handle.getFile();
              const buffer = new Uint8Array(await file.arrayBuffer());
              backupMetadata.files.push({ name, size: file.size });
              filesContent[name] = buffer;
            }
          }
        }
      } catch (err) {
        console.warn('[OPFS Export] Error reading files:', err);
      }
    }

    // Wrap metadata and files into a custom portable bundle
    const payload = JSON.stringify({
      metadata: backupMetadata,
      filesBase64: Object.fromEntries(
        Object.entries(filesContent).map(([k, v]) => [
          k,
          btoa(Array.from(v, b => String.fromCharCode(b)).join('')),
        ])
      ),
    });

    return new Blob([payload], { type: 'application/json' });
  }

  public async importHomeArchive(file: File): Promise<ImportResult> {
    if (!this.isSupported()) {
      return { success: false, importedFilesCount: 0, totalBytes: 0, errors: ['OPFS not supported in this browser'] };
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.metadata || !parsed.filesBase64) {
        return { success: false, importedFilesCount: 0, totalBytes: 0, errors: ['Invalid WebLinux backup archive format'] };
      }

      const root = await navigator.storage.getDirectory();
      const homeHandle = await root.getDirectoryHandle('disk-home', { create: true });

      let importedCount = 0;
      let totalBytes = 0;
      const errors: string[] = [];

      for (const [filename, b64] of Object.entries<string>(parsed.filesBase64)) {
        try {
          const binaryStr = atob(b64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const fileHandle = await homeHandle.getFileHandle(filename, { create: true });
          const accessHandle = await (fileHandle as any).createSyncAccessHandle?.() || await fileHandle.createWritable();
          
          if (accessHandle.write) {
            await accessHandle.write(bytes);
            if (accessHandle.close) await accessHandle.close();
          }

          importedCount++;
          totalBytes += bytes.length;
        } catch (fileErr: any) {
          errors.push(`Failed to import ${filename}: ${fileErr.message}`);
        }
      }

      return {
        success: errors.length === 0,
        importedFilesCount: importedCount,
        totalBytes,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err: any) {
      return { success: false, importedFilesCount: 0, totalBytes: 0, errors: [err.message] };
    }
  }
}
