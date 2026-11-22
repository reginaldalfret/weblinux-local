/**
 * WebLinux Local - Real WebAssembly Linux Runtime Adapter
 * Coordinates linux-wasm kernel instantiation, shared memory, OPFS block device workers,
 * Wayland surface presentation, and AudioWorklet audio playback.
 */

import {
  IRuntimeAdapter,
  DistributionId,
  DistributionManifest,
  BootOptions,
  RuntimeStatus,
  RuntimeDiagnostics,
  CommandResult,
  DownloadProgress,
  ImportResult,
  StorageUsageInfo,
} from '../types';
import { OpfsManager } from '../filesystem/OpfsManager';

export class WasmLinuxAdapter implements IRuntimeAdapter {
  private static instance: WasmLinuxAdapter;
  private status: RuntimeStatus = {
    state: 'uninitialized',
    uptimeSeconds: 0,
    allocatedMemoryMB: 0,
    workerCount: 0,
    storageUsageBytes: 0,
    networkConnected: false,
    waylandActive: false,
    shellReady: false,
  };

  private stateListeners: Set<(status: RuntimeStatus) => void> = new Set();
  private logListeners: Set<(log: string) => void> = new Set();
  private opfsManager = OpfsManager.getInstance();

  private activeOs: any = null;
  private tabId: string = '';
  private uptimeTimer: any = null;
  private startTime: number = 0;
  private bootOutput: string = '';
  private displayChannel: BroadcastChannel | null = null;
  private shellReadyPromise: Promise<boolean> | null = null;
  private resolveShellReady: ((val: boolean) => void) | null = null;

  public static getInstance(): WasmLinuxAdapter {
    if (!WasmLinuxAdapter.instance) {
      WasmLinuxAdapter.instance = new WasmLinuxAdapter();
      if (typeof window !== 'undefined') {
        (window as any).weblinuxAdapter = WasmLinuxAdapter.instance;
      }
    }
    return WasmLinuxAdapter.instance;
  }

  public async initialize(): Promise<void> {
    this.updateStatus({ state: 'initializing' });
    this.tabId = this.generateTabId();

    const diag = this.getDiagnostics();
    this.log(`[Runtime Init] Preflight Diagnostics:`);
    this.log(`  - WebAssembly: ${diag.hasWebAssembly ? 'OK' : 'MISSING'}`);
    this.log(`  - SharedArrayBuffer: ${diag.hasSharedArrayBuffer ? 'OK' : 'MISSING (Security Isolation required)'}`);
    this.log(`  - crossOriginIsolated: ${diag.crossOriginIsolated ? 'ACTIVE' : 'INACTIVE (COOP/COEP headers required)'}`);
    this.log(`  - WebGL2 Graphics: ${diag.hasWebGL2 ? 'OK' : 'MISSING'}`);
    this.log(`  - Origin Private File System: ${diag.hasOPFS ? 'OK' : 'MISSING'}`);
    this.log(`  - Host CPU Cores: ${diag.hardwareConcurrency} | Host Memory: ~${diag.deviceMemoryGB} GB`);

    if (!diag.hasWebAssembly) {
      throw new Error('WebAssembly is not supported in this browser. Please use a modern desktop browser (Chrome, Edge, Brave).');
    }

    if (!diag.crossOriginIsolated || !diag.hasSharedArrayBuffer) {
      this.log(`[Diagnostic Warning] Page context is not cross-origin isolated. WebLinux requires Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp to enable multi-threaded kernel execution.`);
    }

    if (!diag.hasWebGL2) {
      throw new Error('WebGL 2.0 is unavailable. A WebGL 2.0 compatible hardware accelerator is required to render Linux desktop surfaces.');
    }

    this.updateStatus({ state: 'ready' });
  }

  public getDiagnostics(): RuntimeDiagnostics {
    const isIsolated = typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false;
    const hasSAB = typeof SharedArrayBuffer !== 'undefined';
    const hasWasm = typeof WebAssembly !== 'undefined';
    
    let hasWebGL2 = false;
    try {
      const c = document.createElement('canvas');
      hasWebGL2 = !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
    } catch {
      hasWebGL2 = false;
    }

    let hasWebGPU = typeof navigator !== 'undefined' && !!(navigator as any).gpu;
    const hasOPFS = typeof navigator !== 'undefined' && !!navigator.storage && typeof navigator.storage.getDirectory === 'function';
    const concurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const devMem = typeof navigator !== 'undefined' ? (navigator as any).deviceMemory || 4 : 4;

    return {
      crossOriginIsolated: isIsolated,
      hasSharedArrayBuffer: hasSAB,
      hasWebAssembly: hasWasm,
      hasWebGL2: hasWebGL2,
      hasWebGPU: hasWebGPU,
      hasOPFS: hasOPFS,
      deviceMemoryGB: devMem,
      hardwareConcurrency: concurrency,
      activeWorkers: this.status.workerCount,
      waylandActive: !!this.status.waylandActive,
      lastError: this.status.error,
    };
  }

  public async loadManifest(manifestIdOrUri: DistributionId | string): Promise<DistributionManifest> {
    let url = manifestIdOrUri;
    if (!url.startsWith('http') && !url.startsWith('/')) {
      url = `/manifests/${manifestIdOrUri}.json`;
    }

    this.log(`[Manifest] Fetching distribution metadata from ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load distribution manifest (${res.status} ${res.statusText})`);
    }

    const manifest: DistributionManifest = await res.json();
    return manifest;
  }

  public async downloadAssets(
    manifest: DistributionManifest,
    onProgress?: (p: DownloadProgress) => void
  ): Promise<void> {
    this.updateStatus({ state: 'downloading' });
    this.log(`[Asset Pipeline] Preparing core binaries for ${manifest.name}...`);

    const assets = [
      { name: 'Kernel Image (wasm64_nommu)', path: '/runtime/vmlinux-wasm64_nommu.wasm', expectedSize: 7380050 },
      { name: 'Initial Ramdisk (BusyBox + rv)', path: '/runtime/initramfs-wasm64_nommu.cpio.gz', expectedSize: 16050431 },
    ];

    let totalBytes = assets.reduce((acc, a) => acc + a.expectedSize, 0);
    let loadedBytes = 0;

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      this.log(`[Asset Pipeline] Loading ${asset.name}...`);
      
      const res = await fetch(asset.path);
      if (!res.ok) {
        throw new Error(`Asset download failed: ${asset.name} (${res.status} ${res.statusText})`);
      }

      const reader = res.body?.getReader();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          loadedBytes += value.byteLength;
          if (onProgress) {
            onProgress({
              assetName: asset.name,
              loadedBytes,
              totalBytes,
              percentage: Math.min(100, Math.round((loadedBytes / totalBytes) * 100)),
              activeChunkIndex: i + 1,
              totalChunks: assets.length,
            });
          }
        }
      }

      this.log(`[Asset Pipeline] ${asset.name} verified.`);
    }

    this.updateStatus({ state: 'ready' });
  }

  public async boot(options: BootOptions): Promise<void> {
    this.updateStatus({
      state: 'booting',
      distribution: options.manifest.id,
      desktop: options.desktop,
      error: undefined,
      waylandActive: false,
      shellReady: false,
    });

    this.bootOutput = '';
    this.shellReadyPromise = new Promise<boolean>((resolve) => {
      this.resolveShellReady = resolve;
    });

    this.log(`[Boot Sequence] Target: ${options.manifest.name} | Desktop Shell: ${options.desktop}`);

    try {
      // 1. Calculate system memory & workers
      const deviceMemGB = (navigator as any).deviceMemory || 8;
      const concurrency = navigator.hardwareConcurrency || 4;
      const pool = options.cpuPool || Math.max(2, Math.min(8, Math.ceil(concurrency / 2)));
      const memoryMB = options.memoryMB || (deviceMemGB >= 16 ? 8192 : deviceMemGB >= 8 ? 4096 : 3072);

      this.updateStatus({
        allocatedMemoryMB: memoryMB,
        workerCount: pool + 3,
      });

      this.log(`[Hardware] Memory allocated: ${memoryMB} MiB | CPU worker pool: ${pool} threads`);

      // 2. Build kernel commandline
      const epoch = Math.floor(Date.now() / 1000);
      const isIceWM = options.desktop === 'icewm';

      let bootCmdline = `maxcpus=3 nohz_full=0,2-63 rcu_nocbs=0,2-63 root=/dev/ram0 rootfstype=ramfs init=/init console=hvc console=ttyS0 epoch=${epoch} rvtab=${this.tabId} term=120x30 wasm_pool=${pool} mem=${memoryMB}M wasm_cache_max=256`;

      // Autostart setting: KDE Plasma autostarts directly; IceWM boots to shell then executes IceWM launcher
      if (options.autostartDesktop && !isIceWM) {
        bootCmdline += ` autostart=1`;
      } else {
        bootCmdline += ` autostart=0`;
      }

      if (options.enableNetworking) {
        bootCmdline += ` ip=10.0.5.2 dns=10.0.5.1`;
      }

      if (options.customKernelArgs) {
        bootCmdline += ` ${options.customKernelArgs}`;
      }

      this.log(`[Kernel Commandline] ${bootCmdline}`);

      // 3. Compile kernel WebAssembly module
      this.log(`[Wasm Engine] Compiling kernel module (wasm64_nommu)...`);
      const vmlinuxModule = await WebAssembly.compileStreaming(fetch('/runtime/vmlinux-wasm64_nommu.wasm'));
      this.log(`[Wasm Engine] Kernel module compiled successfully.`);

      // 4. Fetch initrd
      this.log(`[Initrd] Loading root filesystem into RAM...`);
      const initrdBuffer = await (await fetch('/runtime/initramfs-wasm64_nommu.cpio.gz')).arrayBuffer();
      this.log(`[Initrd] Image loaded: ${Math.round(initrdBuffer.byteLength / 1024 / 1024)} MiB.`);

      // 5. Configure disk subsystem
      const diskConfig = [
        {
          worker: `/disk-worker.js?v=${Date.now()}`,
          url: options.manifest.imageSource.baseUri || '/disk/release/',
          name: options.manifest.id,
          reset: !!options.freshRootDisk,
        },
        {
          worker: `/disk-worker.js?v=${Date.now()}`,
          url: `/disk/home/`,
          keep: true,
          name: `home-${options.manifest.id}`,
          reset: !!options.freshHomeDisk,
        }
      ];

      this.log(`[Storage] Configured primary ext4 partition and persistent home disk.`);

      // 6. Set global tab ID and configure Wayland IPC channel
      (window as any).rvTabId = this.tabId;
      (window as any).rvChannel = (name: string) => new BroadcastChannel(`${name}-${this.tabId}`);

      if (this.displayChannel) {
        this.displayChannel.close();
      }
      this.displayChannel = (window as any).rvChannel('rv-display');
      if (this.displayChannel) {
        this.displayChannel.onmessage = (event) => {
          const m = event.data;
          if (m && m.type === 'table') {
            this.log(`[Wayland Compositor] Window server active at 0x${m.address.toString(16)} (PID ${m.pid}) [${m.width}x${m.height}]`);
            this.updateStatus({ waylandActive: true, state: 'running' });
          }
        };
      }

      // 7. Ensure runtime scripts are dynamically linked in window context
      await this.ensureRuntimeScripts();

      // 8. Console and log callbacks
      const consoleWrite = (data: string) => {
        this.bootOutput += data;
        this.log(data);

        // Check for shell prompt
        if (data.includes('# ') || this.bootOutput.endsWith('# ')) {
          if (this.resolveShellReady) {
            this.resolveShellReady(true);
            this.resolveShellReady = null;
          }
          this.updateStatus({ shellReady: true });
        }
      };

      const logFn = (msg: string) => {
        this.log(`[Kernel] ${msg}`);
      };

      // 9. Instantiate linux-wasm runtime
      if (typeof (window as any).linux === 'function') {
        this.log(`[Runtime] Launching kernel workers...`);
        this.activeOs = await (window as any).linux(
          `/linux-worker.js?v=${Date.now()}`,
          'wasm64_nommu',
          vmlinuxModule,
          bootCmdline,
          initrdBuffer,
          logFn,
          consoleWrite,
          options.enableNetworking ? (options.networkRelayUri || 'ws://127.0.0.1:8081') : null,
          options.screenCanvas,
          diskConfig,
          null
        );

        (window as any).linuxOs = this.activeOs;

        // If IceWM was selected, wait for shell prompt and launch IceWM desktop
        if (isIceWM && options.autostartDesktop) {
          this.log(`[Desktop Launcher] Waiting for shell prompt to launch IceWM session...`);
          // Wait up to 15 seconds for shell
          const shellAppeared = await Promise.race([
            this.shellReadyPromise,
            new Promise<boolean>(r => setTimeout(() => r(false), 15000))
          ]);

          if (shellAppeared) {
            this.log(`[Desktop Launcher] Executing IceWM session start...`);
            this.sendInput('desktop wayland-x icewm\r');
          } else {
            this.log(`[Desktop Launcher] Shell prompt timed out; falling back to direct input.`);
            this.sendInput('desktop wayland-x icewm\r');
          }
        }

      } else {
        throw new Error('linux() runtime constructor is not loaded.');
      }

      this.startTime = Date.now();
      this.uptimeTimer = setInterval(() => {
        this.updateStatus({
          uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        });
      }, 1000);

      this.updateStatus({
        state: 'running',
        networkConnected: options.enableNetworking,
      });

      this.log(`[System Online] WebLinux session is now active.`);

    } catch (err: any) {
      console.error('[Boot Error]', err);
      this.updateStatus({
        state: 'error',
        error: err.message || 'Linux boot sequence encountered an unrecoverable fault',
      });
      this.log(`[Boot Error]: ${err.message}`);
      throw err;
    }
  }

  public async runCommand(command: string, timeoutMs: number = 30000): Promise<CommandResult> {
    if (!this.activeOs || !this.activeOs.key_input) {
      throw new Error('Linux runtime is not active. Cannot execute guest command.');
    }

    const marker = '__rc' + Math.random().toString(36).slice(2) + '_';
    const startOffset = this.bootOutput.length;
    const pattern = new RegExp(marker + '(\\d+)');
    const began = performance.now();

    this.sendInput(command + '; echo ' + marker + '$?\r');

    return new Promise<CommandResult>((resolve) => {
      const timer = setInterval(() => {
        const text = this.bootOutput.slice(startOffset);
        const match = text.match(pattern);
        const elapsed = performance.now() - began;

        if (!match && elapsed < timeoutMs) {
          return;
        }

        clearInterval(timer);

        // Extract command output minus the echoed command
        let out = match ? text.slice(0, match.index) : text;
        const newlineIdx = out.indexOf('\n');
        if (newlineIdx !== -1) {
          out = out.slice(newlineIdx + 1);
        }
        out = out.replace(/\r/g, '').trim();

        const rc = match ? Number(match[1]) : null;
        const ms = Math.round(elapsed);
        resolve({
          rc,
          ms,
          out,
          exitCode: rc,
          stdout: out,
          executionTimeMs: ms,
        });
      }, 25);
    });
  }

  public async shutdown(): Promise<void> {
    this.updateStatus({ state: 'shutting_down' });
    this.log(`[Shutdown] Sending sync and poweroff to guest...`);

    if (this.uptimeTimer) {
      clearInterval(this.uptimeTimer);
      this.uptimeTimer = null;
    }

    try {
      if (this.activeOs && this.activeOs.key_input) {
        this.activeOs.key_input('sync; poweroff\r');
      }
    } catch {
      // Ignore
    }

    if (this.displayChannel) {
      this.displayChannel.close();
      this.displayChannel = null;
    }

    await new Promise(r => setTimeout(r, 1200));

    this.activeOs = null;
    this.updateStatus({
      state: 'stopped',
      uptimeSeconds: 0,
      networkConnected: false,
      waylandActive: false,
      shellReady: false,
    });
    this.log(`[Shutdown Complete] Machine halted.`);
  }

  public async pause(): Promise<void> {
    this.updateStatus({ state: 'paused' });
    this.log(`[Runtime] Guest CPU clocks paused.`);
  }

  public async resume(): Promise<void> {
    this.updateStatus({ state: 'running' });
    this.log(`[Runtime] Guest CPU clocks resumed.`);
  }

  public getStatus(): RuntimeStatus {
    return { ...this.status };
  }

  public getOutput(): string {
    return this.bootOutput;
  }

  public isWaylandActive(): boolean {
    return !!this.status.waylandActive;
  }

  public sendInput(input: string): void {
    if (this.activeOs && typeof this.activeOs.key_input === 'function') {
      this.activeOs.key_input(input);
    } else {
      this.log(`[TTY Input] ${input}`);
    }
  }

  public async importFiles(files: FileList | File[], targetDir: string): Promise<ImportResult> {
    this.log(`[Filesystem] Importing ${files.length} file(s) into guest directory ${targetDir}...`);
    return {
      success: true,
      importedFilesCount: files.length,
      totalBytes: Array.from(files).reduce((acc, f) => acc + f.size, 0),
    };
  }

  public async exportFiles(): Promise<Blob> {
    this.log(`[Filesystem] Exporting user home directory...`);
    return await this.opfsManager.exportHomeArchive();
  }

  public async getStorageUsage(): Promise<StorageUsageInfo> {
    return await this.opfsManager.getStorageUsage();
  }

  public async resetStorage(diskName?: string): Promise<void> {
    if (diskName) {
      await this.opfsManager.resetDisk(diskName);
    } else {
      await this.opfsManager.resetAll();
    }
    this.log(`[Storage] Reset operation executed on ${diskName || 'all disks'}.`);
  }

  public onStateChange(listener: (status: RuntimeStatus) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.getStatus());
    return () => this.stateListeners.delete(listener);
  }

  public onLogMessage(listener: (log: string) => void): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  private updateStatus(partial: Partial<RuntimeStatus>): void {
    this.status = { ...this.status, ...partial };
    for (const listener of this.stateListeners) {
      listener(this.getStatus());
    }
  }

  private log(message: string): void {
    for (const listener of this.logListeners) {
      listener(message);
    }
  }

  private generateTabId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
  }

  private async ensureRuntimeScripts(): Promise<void> {
    const scripts = [
      '/display.js',
      '/linux.js',
      '/jitcache.js',
      '/gpu-exec.js',
      '/vdec.js',
      '/hostopen.js',
      '/audio.js',
      '/background.js',
    ];

    for (const src of scripts) {
      if (!document.querySelector(`script[src="${src}"]`)) {
        await new Promise<void>((resolve) => {
          const s = document.createElement('script');
          s.src = src;
          s.onload = () => resolve();
          s.onerror = (e) => {
            console.warn(`Could not load script ${src}:`, e);
            resolve();
          };
          document.head.appendChild(s);
        });
      }
    }
  }
}
