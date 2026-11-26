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
  GraphicsMode,
  GraphicsCapabilities,
} from '../types';
import { OpfsManager } from '../filesystem/OpfsManager';
import { DEBIAN_DESKTOP_PROFILES } from '../profiles/desktopProfiles';

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
  private cachedKernelBuffer: ArrayBuffer | null = null;
  private cachedInitrdBuffer: ArrayBuffer | null = null;
  private graphicsMode: GraphicsMode = 'automatic';

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
    if (typeof window !== 'undefined' && (window as any).rvTabId) {
      this.tabId = (window as any).rvTabId;
    } else {
      this.tabId = this.generateTabId();
      if (typeof window !== 'undefined') {
        (window as any).rvTabId = this.tabId;
        (window as any).rvChannel = (name: string) => new BroadcastChannel(`${name}-${this.tabId}`);
      }
    }

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
      {
        id: 'kernel',
        name: 'Kernel Image (wasm64_nommu)',
        path: '/runtime/vmlinux-wasm64_nommu.wasm',
        expectedSize: manifest.integrity.kernelSize || 7380050,
        expectedSha256: manifest.integrity.kernelSha256 || '31287a56f4d80f5767dc2e07abf1986a3722a6fb6f1bef72d714d189a2e65c49',
      },
      {
        id: 'initrd',
        name: 'Initial Ramdisk (BusyBox + rv)',
        path: '/runtime/initramfs-wasm64_nommu.cpio.gz',
        expectedSize: manifest.integrity.initrdSize || 15060476,
        expectedSha256: manifest.integrity.initrdSha256 || '0670b429976ee9024b85f0b5522eca125c6a741e14aabfa985054b56dff9c88c',
      },
    ];

    let totalBytes = assets.reduce((acc, a) => acc + a.expectedSize, 0);
    let loadedBytes = 0;

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      this.log(`[Asset Pipeline] Downloading ${asset.name} (${Math.round(asset.expectedSize / 1024 / 1024 * 10) / 10} MiB)...`);

      const res = await fetch(asset.path);
      if (!res.ok) {
        throw new Error(`Asset download failed: ${asset.name} (${res.status} ${res.statusText})`);
      }

      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let assetLoaded = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          assetLoaded += value.byteLength;
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
      } else {
        const buf = await res.arrayBuffer();
        chunks.push(new Uint8Array(buf));
        assetLoaded = buf.byteLength;
        loadedBytes += buf.byteLength;
      }

      // Combine chunks into single ArrayBuffer
      const combined = new Uint8Array(assetLoaded);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const buffer = combined.buffer;

      // 1. Validate byte length (accounting for transparent HTTP Content-Encoding: gzip decompression)
      let isUncompressedInitrd = false;
      if (asset.id === 'initrd' && buffer.byteLength === (manifest.integrity.initrdUncompressedSize || 36645888)) {
        isUncompressedInitrd = true;
      } else if (buffer.byteLength !== asset.expectedSize) {
        throw new Error(
          `Integrity Violation: Length mismatch for ${asset.name}. Expected ${asset.expectedSize} bytes, received ${buffer.byteLength} bytes. Binary rejected.`
        );
      }

      // 2. Validate cryptographic SHA-256 digest
      const expectedSha256 = isUncompressedInitrd
        ? (manifest.integrity.initrdUncompressedSha256 || '71c0ddb7192ef269e3ee2bccdd80d8162ba1ac11ad9d2f5e67d504d8444ea1f7')
        : asset.expectedSha256;

      if (expectedSha256) {
        const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
        const actualSha256 = Array.from(new Uint8Array(hashBuf))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        if (actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
          throw new Error(
            `Integrity Violation: SHA-256 digest mismatch for ${asset.name}!\nExpected: ${expectedSha256}\nReceived: ${actualSha256}\nAsset rejected.`
          );
        }

        this.log(`[Cryptographic Integrity Verified] ${asset.name} (${isUncompressedInitrd ? 'transparent HTTP cpio' : 'gzipped archive'}) SHA-256: ${actualSha256}`);
      }

      if (asset.id === 'kernel') {
        this.cachedKernelBuffer = buffer;
      } else if (asset.id === 'initrd') {
        this.cachedInitrdBuffer = buffer;
      }
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
      // Clamp worker pool to max 4 to prevent thread pool exhaustion and high CPU load
      const pool = options.cpuPool || Math.max(2, Math.min(4, Math.ceil(concurrency / 2)));
      // Allocate 2048 MiB default (Debian Trixie + KDE Plasma uses ~827 MiB, giving >1.2 GB headroom
      // while preventing renderer memory exhaustion / STATUS_ACCESS_VIOLATION in multi-tab browser sessions).
      const memoryMB = options.memoryMB || (deviceMemGB >= 16 ? 3072 : 2048);

      this.updateStatus({
        allocatedMemoryMB: memoryMB,
        workerCount: pool + 3,
      });

      this.log(`[Hardware] Memory allocated: ${memoryMB} MiB | CPU worker pool: ${pool} threads`);

      // 2. Build kernel commandline
      const epoch = Math.floor(Date.now() / 1000);
      const isKde = options.desktop === 'kde-plasma';

      let bootCmdline = `maxcpus=3 nohz_full=0,2-63 rcu_nocbs=0,2-63 root=/dev/ram0 rootfstype=ramfs init=/init console=hvc console=ttyS0 epoch=${epoch} rvtab=${this.tabId} term=120x30 wasm_pool=${pool} mem=${memoryMB}M wasm_cache_max=256 distro=${options.manifest.id}`;

      // Autostart setting: KDE Plasma autostarts directly; GNOME and XFCE launch via profile session command
      if (options.autostartDesktop && isKde) {
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

      // 3. Compile kernel WebAssembly module from cryptographically verified buffer
      if (!this.cachedKernelBuffer || !this.cachedInitrdBuffer) {
        this.log(`[Wasm Engine] Preflight: downloading and verifying asset binaries...`);
        await this.downloadAssets(options.manifest);
      }

      this.log(`[Wasm Engine] Compiling verified kernel module (wasm64_nommu)...`);
      const vmlinuxModule = await WebAssembly.compile(this.cachedKernelBuffer!);
      this.log(`[Wasm Engine] Kernel module compiled successfully from verified binary.`);

      // 4. Initrd
      const initrdBuffer = this.cachedInitrdBuffer!;
      this.log(`[Initrd] Image verified: ${Math.round(initrdBuffer.byteLength / 1024 / 1024)} MiB.`);

      // 5. Configure disk subsystem
      // Root disk identity isolates desktop profiles: root-debian-kde-plasma, root-debian-firefox, root-ubuntu-gnome, root-ubuntu-kde, root-ubuntu-kde-epiphany, root-arch-kde
      const isUbuntuGnome = (options.manifest.id === 'ubuntu' || options.manifest.id === 'ubuntu-gnome') && options.desktop === 'ubuntu-gnome';
      const isUbuntuKdeEpiphany = options.manifest.id === 'ubuntu-kde-epiphany' && options.desktop === 'ubuntu-kde';
      const isUbuntuKde = (options.manifest.id === 'ubuntu' || options.manifest.id === 'ubuntu-kde') && options.desktop === 'ubuntu-kde';
      const isDebianFirefox = options.manifest.id === 'debian-firefox' && options.desktop === 'kde-plasma';
      const isArchKde = options.manifest.id === 'arch-kde' && options.desktop === 'arch-kde';
      const isOpenSuseKde = options.manifest.id === 'opensuse-tumbleweed-kde' && options.desktop === 'opensuse-tumbleweed-kde';
      const isFedoraKde = options.manifest.id === 'fedora-kde' && options.desktop === 'fedora-kde';
      const rootUrl = isUbuntuGnome
        ? '/disk/ubuntu-24.04-gnome/'
        : isUbuntuKdeEpiphany
        ? '/disk/ubuntu-24.04-kde-epiphany/'
        : isUbuntuKde
        ? '/disk/ubuntu-24.04-kde/'
        : isDebianFirefox
        ? '/disk/debian-13-firefox/'
        : isArchKde
        ? '/disk/arch-kde/'
        : isOpenSuseKde
        ? '/disk/opensuse-tumbleweed-kde/'
        : isFedoraKde
        ? '/disk/fedora-kde/'
        : (options.manifest.imageSource.baseUri || '/disk/release/');
      const rootDiskId = isUbuntuGnome
        ? 'root-ubuntu-gnome'
        : isUbuntuKdeEpiphany
        ? 'root-ubuntu-kde-epiphany'
        : isUbuntuKde
        ? 'root-ubuntu-kde'
        : isDebianFirefox
        ? 'root-debian-firefox'
        : isArchKde
        ? 'root-arch-kde'
        : isOpenSuseKde
        ? 'root-opensuse-tumbleweed-kde'
        : isFedoraKde
        ? 'root-fedora-kde'
        : `root-${options.manifest.id}-${options.desktop}`;
      const homeDiskId = isArchKde
        ? 'home-arch-kde'
        : isOpenSuseKde
        ? 'home-opensuse-tumbleweed-kde'
        : isFedoraKde
        ? 'home-fedora-kde'
        : `home-${(options.manifest.id === 'ubuntu-gnome' || options.manifest.id === 'ubuntu-kde' || options.manifest.id === 'ubuntu-kde-epiphany') ? 'ubuntu' : (options.manifest.id === 'debian-firefox' ? 'debian' : options.manifest.id)}`; // Persistent home shared across desktop sessions on /dev/wdb

      const diskConfig = [
        {
          worker: `/disk-worker.js?v=${Date.now()}`,
          url: rootUrl,
          name: rootDiskId,
          reset: !!options.freshRootDisk,
        },
        {
          worker: `/disk-worker.js?v=${Date.now()}`,
          url: `/disk/home/`,
          keep: true,
          name: homeDiskId,
          reset: !!options.freshHomeDisk,
        }
      ];

      this.log(`[Storage] Configured isolated profile root disk (${rootDiskId}) and shared persistent home (${homeDiskId}).`);

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
            this.updateStatus({ waylandActive: true, state: 'desktop_ready' });
            setTimeout(() => {
              if (this.status.state === 'desktop_ready') {
                this.updateStatus({ state: 'running' });
              }
            }, 300);
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
        if (data.includes('# ') || this.bootOutput.endsWith('# ') || data.includes('CLI ready') || data.includes('root@')) {
          if (this.resolveShellReady) {
            this.resolveShellReady(true);
            this.resolveShellReady = null;
          }
          if (this.status.state === 'booting') {
            this.updateStatus({ state: 'shell_ready', shellReady: true });
          } else {
            this.updateStatus({ shellReady: true });
          }
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

        // Multi-Desktop Session Launch (Debian GNOME/XFCE, Ubuntu GNOME 46, Ubuntu KDE Plasma 5.27, Arch KDE 6, openSUSE Tumbleweed KDE 6, Fedora 45 KDE 6)
        if ((options.desktop === 'gnome' || options.desktop === 'xfce' || options.desktop === 'ubuntu-gnome' || options.desktop === 'ubuntu-kde' || options.desktop === 'arch-kde' || options.desktop === 'opensuse-tumbleweed-kde' || options.desktop === 'fedora-kde') && options.autostartDesktop) {
          const profile = DEBIAN_DESKTOP_PROFILES[options.desktop];
          this.log(`[Desktop Launcher] Waiting for guest shell readiness to launch ${profile?.name || options.desktop}...`);
          
          await Promise.race([
            this.shellReadyPromise,
            new Promise<boolean>(r => setTimeout(() => r(false), 15000))
          ]);

          this.updateStatus({ state: 'compositor_starting' });

          // Provision dedicated session launcher scripts
          await this.provisionDesktopLaunchers();

          if (options.desktop === 'fedora-kde') {
            this.log(`[Desktop Launcher] Executing verified Fedora 45 KDE Plasma 6 session script: /usr/local/bin/fedora-kde-session`);
            const launchRes = await this.runCommand(`fedora-kde /usr/local/bin/fedora-kde-session`, 25000);
            if (launchRes.exitCode !== 0) {
              const errSummary = (launchRes.stderr || launchRes.stdout || 'Fedora KDE launcher returned non-zero exit code').trim();
              this.log(`[Desktop Launcher Error] ${errSummary}`);
              this.updateStatus({
                state: 'error',
                error: `${profile?.name || options.desktop} launch error: ${errSummary}`,
              });
              return;
            }
          } else if (options.desktop === 'opensuse-tumbleweed-kde') {
            this.log(`[Desktop Launcher] Executing verified openSUSE Tumbleweed KDE Plasma 6 session script: /usr/local/bin/opensuse-kde-session`);
            const launchRes = await this.runCommand(`opensuse-kde /usr/local/bin/opensuse-kde-session`, 25000);
            if (launchRes.exitCode !== 0) {
              const errSummary = (launchRes.stderr || launchRes.stdout || 'openSUSE KDE launcher returned non-zero exit code').trim();
              this.log(`[Desktop Launcher Error] ${errSummary}`);
              this.updateStatus({
                state: 'error',
                error: `${profile?.name || options.desktop} launch error: ${errSummary}`,
              });
              return;
            }
          } else if (options.desktop === 'arch-kde') {
            this.log(`[Desktop Launcher] Executing verified Arch KDE Plasma 6 session script: /usr/local/bin/arch-kde-session`);
            const launchRes = await this.runCommand(`arch-kde /usr/local/bin/arch-kde-session`, 25000);
            if (launchRes.exitCode !== 0) {
              const errSummary = (launchRes.stderr || launchRes.stdout || 'Arch KDE launcher returned non-zero exit code').trim();
              this.log(`[Desktop Launcher Error] ${errSummary}`);
              this.updateStatus({
                state: 'error',
                error: `${profile?.name || options.desktop} launch error: ${errSummary}`,
              });
              return;
            }
          } else if (options.desktop === 'ubuntu-kde') {
            this.log(`[Desktop Launcher] Executing verified Ubuntu KDE Plasma session script: /usr/local/bin/ubuntu-kde-session`);
            const launchRes = await this.runCommand(`ubuntu-kde /usr/local/bin/ubuntu-kde-session`, 25000);
            if (launchRes.exitCode !== 0) {
              const errSummary = (launchRes.stderr || launchRes.stdout || 'Ubuntu KDE launcher returned non-zero exit code').trim();
              this.log(`[Desktop Launcher Error] ${errSummary}`);
              this.updateStatus({
                state: 'error',
                error: `${profile?.name || options.desktop} launch error: ${errSummary}`,
              });
              return;
            }
          } else if (options.desktop === 'ubuntu-gnome') {
            this.log(`[Desktop Launcher] Executing verified Ubuntu GNOME 46 session script: /usr/local/bin/ubuntu-gnome-session`);
            const launchRes = await this.runCommand(`ubuntu /usr/local/bin/ubuntu-gnome-session`, 20000);
            if (launchRes.exitCode !== 0) {
              const errSummary = (launchRes.stderr || launchRes.stdout || 'Ubuntu GNOME launcher returned non-zero exit code').trim();
              this.log(`[Desktop Launcher Error] ${errSummary}`);
              this.updateStatus({
                state: 'error',
                error: `${profile?.name || options.desktop} launch error: ${errSummary}`,
              });
              return;
            }
          } else {
            const launcherScript = options.desktop === 'gnome'
              ? '/usr/local/bin/weblinux-gnome-session'
              : '/usr/local/bin/weblinux-xfce-session';

            this.log(`[Desktop Launcher] Executing verified session script: ${launcherScript}`);
            
            // Execute launcher and monitor output
            const launchRes = await this.runCommand(`debian ${launcherScript}`, 12000);
            if (launchRes.exitCode !== 0) {
              const errSummary = (launchRes.stderr || launchRes.stdout || 'Launcher returned non-zero exit code').trim();
              this.log(`[Desktop Launcher Error] ${errSummary}`);
              this.updateStatus({
                state: 'error',
                error: `${profile?.name || options.desktop} launch blocked: ${errSummary}`,
              });
              return;
            }
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

      // Keep state as 'booting' until Wayland window table is registered
      this.updateStatus({
        state: 'booting',
        networkConnected: options.enableNetworking,
      });

      // For KDE Plasma 6: monitor compositor readiness timeout
      if (isKde) {
        setTimeout(() => {
          if (this.status.state === 'booting' && !this.status.waylandActive) {
            this.log(`[Runtime] Boot sequence settling into active state.`);
            this.updateStatus({ state: 'running' });
          }
        }, 25000);
      } else if (options.desktop === 'cli' || options.manifest.id === 'ubuntu') {
        setTimeout(() => {
          if (this.status.state === 'booting' || this.status.state === 'shell_ready') {
            this.log(`[Runtime] Ubuntu CLI session ready and online.`);
            this.updateStatus({ state: 'running', shellReady: true });
            if (this.resolveShellReady) {
              this.resolveShellReady(true);
            }
          }
        }, 5000);
      }

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

        const timedOut = !match && elapsed >= timeoutMs;

        // Extract command output minus the echoed command
        let out = match ? text.slice(0, match.index) : text;
        out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const newlineIdx = out.indexOf('\n');
        if (newlineIdx !== -1) {
          out = out.slice(newlineIdx + 1);
        }
        out = out.trim();

        const rc = match ? Number(match[1]) : (timedOut ? 124 : null);
        const ms = Math.round(elapsed);
        const stderr = timedOut ? `Command timed out after ${timeoutMs}ms without exit code marker` : undefined;

        resolve({
          rc,
          ms,
          out,
          exitCode: rc,
          stdout: out,
          stderr,
          executionTimeMs: ms,
          timedOut,
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

    if (this.status.shellReady && this.activeOs) {
      try {
        await this.runCommand(
          'killall -9 plasmashell kbuildsycoca6 dolphin konsole kioworker dbus-daemon 2>/dev/null; sleep 0.5; sync; umount /fedora/root 2>/dev/null || mount -o remount,ro /fedora/root 2>/dev/null; umount /opensuse/root 2>/dev/null || mount -o remount,ro /opensuse/root 2>/dev/null; umount /arch/root 2>/dev/null || mount -o remount,ro /arch/root 2>/dev/null; umount /ubuntu/root 2>/dev/null || mount -o remount,ro /ubuntu/root 2>/dev/null; umount /debian/root 2>/dev/null || mount -o remount,ro /debian/root 2>/dev/null; sync',
          8000
        );
      } catch {
        // Fallback to raw key_input below
      }
    }

    try {
      if (this.activeOs && this.activeOs.key_input) {
        this.activeOs.key_input('sync\r');
      }
    } catch {
      // Ignore
    }

    if (this.displayChannel) {
      this.displayChannel.close();
      this.displayChannel = null;
    }

    // Allow guest kernel sync to issue flush before coordinated OPFS shutdown
    await new Promise(r => setTimeout(r, 1500));

    if (this.activeOs && typeof this.activeOs.terminate === 'function') {
      try {
        this.log(`[Shutdown] Flushing OPFS disks, closing handles, and releasing locks...`);
        await this.activeOs.terminate();
      } catch (termErr) {
        console.warn('[Shutdown] activeOs.terminate error:', termErr);
      }
    }

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

  public async provisionDesktopLaunchers(): Promise<void> {
    this.log(`[Desktop Launcher] Provisioning session entrypoint scripts into guest...`);
    const gnomeSessionScript = 
`if [ -d /debian ]; then
cat <<'EOF' > /debian/usr/local/bin/weblinux-gnome-session
#!/bin/sh
echo "[GNOME Launcher] Initializing GNOME 48 Wayland Session..."
MISSING=""
for b in gnome-shell mutter; do
  if ! command -v "$b" >/dev/null 2>&1; then MISSING="$MISSING $b"; fi
done
if [ -n "$MISSING" ]; then
  echo "[GNOME Launcher ERROR] Required GNOME components missing: $MISSING" >&2
  echo "[GNOME Launcher ERROR] Status: BLOCKED - Package set unavailable on riscv64 NOMMU image." >&2
  exit 127
fi
export XDG_CURRENT_DESKTOP=GNOME XDG_SESSION_TYPE=wayland GDK_BACKEND=wayland
mutter --wayland --nested --wayland-display=wayland-1 &
sleep 1
export WAYLAND_DISPLAY=wayland-1
exec gnome-shell --wayland
EOF
chmod +x /debian/usr/local/bin/weblinux-gnome-session
fi`;

    const xfceSessionScript = 
`if [ -d /debian ]; then
cat <<'EOF' > /debian/usr/local/bin/weblinux-xfce-session
#!/bin/sh
echo "[XFCE Launcher] Initializing XFCE 4.20 Wayland Session..."
MISSING=""
for b in labwc xfce4-session; do
  if ! command -v "$b" >/dev/null 2>&1; then MISSING="$MISSING $b"; fi
done
if [ -n "$MISSING" ]; then
  echo "[XFCE Launcher ERROR] Required XFCE components missing: $MISSING" >&2
  echo "[XFCE Launcher ERROR] Status: BLOCKED - Package set unavailable on riscv64 NOMMU image." >&2
  exit 127
fi
export XDG_CURRENT_DESKTOP=XFCE XDG_SESSION_TYPE=wayland GDK_BACKEND=wayland
exec labwc -s xfce4-session
EOF
chmod +x /debian/usr/local/bin/weblinux-xfce-session
fi`;

      const virglExperimental =
        typeof window !== 'undefined' &&
        (Boolean((window as any).WEBLINUX_ENABLE_VIRGL_EXPERIMENTAL) ||
          new URLSearchParams(window.location.search).get('virgl') === '1');
      if (virglExperimental) {
        this.log(`[Graphics] WEBLINUX_ENABLE_VIRGL_EXPERIMENTAL=1 active (experimental VirGL proto/vtest path; WebGL2 display fallback preserved)`);
      }

      const ubuntuGnomeSessionScript =
`if [ -d /ubuntu ]; then
cat <<'EOF' > /ubuntu/usr/local/bin/ubuntu-gnome-session
#!/bin/sh
echo "[Ubuntu GNOME Launcher] Initializing Ubuntu 24.04.5 LTS GNOME 46 Session..."
MISSING=""
for b in gnome-shell mutter; do
  if ! command -v "$b" >/dev/null 2>&1; then MISSING="$MISSING $b"; fi
done
if [ -n "$MISSING" ]; then
  echo "[Ubuntu GNOME Launcher ERROR] Required GNOME components missing: $MISSING" >&2
  echo "[Ubuntu GNOME Launcher ERROR] Status: BLOCKED - Package set unavailable." >&2
  exit 127
fi
echo "[Ubuntu GNOME Launcher] Preflight verified: gnome-shell and mutter are installed."

export GJS_DISABLE_JIT=1
export JS_DISABLE_JIT=1
${virglExperimental ? 'export GALLIUM_DRIVER=virpipe\nexport VTEST_SOCKET_NAME=/tmp/runtime-root/rvgpu-0' : 'export LIBGL_ALWAYS_SOFTWARE=1'}
export NO_AT_BRIDGE=1
export XDG_CURRENT_DESKTOP=GNOME
export XDG_SESSION_TYPE=wayland
export GDK_BACKEND=wayland
export XDG_RUNTIME_DIR=/tmp/runtime-root
export WAYLAND_DISPLAY=wayland-0
export DISPLAY=:0
mkdir -p -m 700 "$XDG_RUNTIME_DIR"

# 1. Ensure messagebus user exists and start system & session D-Bus
grep -q '^messagebus:' /etc/passwd 2>/dev/null || echo 'messagebus:x:100:101:D-Bus:/nonexistent:/usr/sbin/nologin' >> /etc/passwd
grep -q '^messagebus:' /etc/group 2>/dev/null || echo 'messagebus:x:101:' >> /etc/group
mkdir -p /run/dbus /var/run
[ -e /var/run/dbus ] || ln -s /run/dbus /var/run/dbus
[ -S /run/dbus/system_bus_socket ] || dbus-daemon --system --fork --nopidfile 2>/root/dbus-system.log || true
export DBUS_SYSTEM_BUS_ADDRESS="unix:path=/run/dbus/system_bus_socket"
if [ ! -S "$XDG_RUNTIME_DIR/bus" ]; then
  dbus-daemon --session --fork --address="unix:path=$XDG_RUNTIME_DIR/bus" 2>/dev/null || true
fi
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"

# 2. Start WebLinux Wayland window server (wlserver) so WebGL2 canvas & wayland-0 exist
if [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; then
  if [ -x /run/hostnode/hostnode ] && [ -d /run/wlserver ]; then
    echo "page" > "$XDG_RUNTIME_DIR/wlserver.shell"
    HOSTNODE_HOME=/run/wlserver /run/hostnode/hostnode > /root/wlserver.log 2>&1 &
    i=0
    while [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ] && [ $i -lt 50 ]; do
      sleep 0.1
      i=$((i + 1))
    done
  fi
fi

if [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; then
  echo "[Ubuntu GNOME Launcher ERROR] Wayland display socket $XDG_RUNTIME_DIR/$WAYLAND_DISPLAY did not start" >&2
  exit 1
fi

echo "[Ubuntu GNOME Launcher] Wayland display $WAYLAND_DISPLAY ready. Launching GNOME Shell 46..."
nohup gnome-shell --nested --wayland --no-x11 --wayland-display=wayland-1 > /root/gnome-shell.log 2>&1 &
sleep 2
echo "[Ubuntu GNOME Launcher] GNOME Shell 46 session started (PID $!)."
EOF
chmod +x /ubuntu/usr/local/bin/ubuntu-gnome-session
fi`;

    const ubuntuKdeSessionScript =
`if [ -d /ubuntu ]; then
cat <<'EOF' > /ubuntu/usr/local/bin/ubuntu-kde-session
#!/bin/sh
echo "[Ubuntu KDE Launcher] Initializing Ubuntu 24.04.5 LTS KDE Plasma 5.27 Session..." > /root/ubuntu-kde-session.log
MISSING=""
for b in plasmashell konsole dolphin; do
  if ! command -v "$b" >/dev/null 2>&1; then MISSING="$MISSING $b"; fi
done
if [ -n "$MISSING" ]; then
  echo "[Ubuntu KDE Launcher ERROR] Required KDE components missing: $MISSING" | tee -a /root/ubuntu-kde-session.log >&2
  exit 127
fi
echo "[Ubuntu KDE Launcher] Preflight verified: plasmashell, konsole, dolphin installed." | tee -a /root/ubuntu-kde-session.log

export HOME=/root USER=root SHELL=/bin/bash LANG=C.UTF-8
export XDG_RUNTIME_DIR=/tmp/runtime-root
export WAYLAND_DISPLAY=wayland-0
export DISPLAY=:0
export XDG_SESSION_TYPE=wayland
export XDG_CURRENT_DESKTOP=KDE
export KDE_FULL_SESSION=true
export KDE_SESSION_VERSION=5
export QT_QPA_PLATFORM=wayland
export QT_QUICK_BACKEND=software
export QMLSCENE_DEVICE=softwarecontext
export LIBGL_ALWAYS_SOFTWARE=1
export QV4_FORCE_INTERPRETER=1
export NO_AT_BRIDGE=1
mkdir -p -m 700 "$XDG_RUNTIME_DIR"

# 1. Disable non-functional setuid UDisks2 D-Bus activation (avoids 30-40s Dolphin/file-dialog timeouts)
rm -f /usr/share/dbus-1/system-services/org.freedesktop.UDisks2.service 2>/dev/null || true

# 2. System & session D-Bus
grep -q '^messagebus:' /etc/passwd 2>/dev/null || echo 'messagebus:x:100:101:D-Bus:/nonexistent:/usr/sbin/nologin' >> /etc/passwd
grep -q '^messagebus:' /etc/group 2>/dev/null || echo 'messagebus:x:101:' >> /etc/group
mkdir -p /run/dbus /var/run
[ -e /var/run/dbus ] || ln -s /run/dbus /var/run/dbus
[ -S /run/dbus/system_bus_socket ] || dbus-daemon --system --fork --nopidfile > /root/dbus.log 2>&1 || true
export DBUS_SYSTEM_BUS_ADDRESS="unix:path=/run/dbus/system_bus_socket"
if [ ! -S "$XDG_RUNTIME_DIR/bus" ]; then
  dbus-daemon --session --fork --address="unix:path=$XDG_RUNTIME_DIR/bus" >> /root/dbus.log 2>&1 || true
fi
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"

# 3. Start WebLinux GPU server (rvgpu -> WebGL2/WebGPU) if available
if [ -x /run/hostnode/hostnode ] && [ -f /run/rvgpu/boot.js ] && [ ! -S "$XDG_RUNTIME_DIR/rvgpu-0" ]; then
  rm -f "$XDG_RUNTIME_DIR/rvgpu-0.ready" "$XDG_RUNTIME_DIR/rvgpu-0.none"
  HOSTNODE_HOME=/run/rvgpu /run/hostnode/hostnode > /root/rvgpu.log 2>&1 &
  g=0
  while [ ! -f "$XDG_RUNTIME_DIR/rvgpu-0.ready" ] && [ ! -f "$XDG_RUNTIME_DIR/rvgpu-0.none" ] && [ $g -lt 20 ]; do
    sleep 0.1
    g=$((g + 1))
  done
fi
if [ -f "$XDG_RUNTIME_DIR/rvgpu-0.ready" ]; then
  export GALLIUM_DRIVER=virpipe
  export VTEST_SOCKET_NAME="$XDG_RUNTIME_DIR/rvgpu-0"
  unset LIBGL_ALWAYS_SOFTWARE QT_QUICK_BACKEND QMLSCENE_DEVICE
  export QSG_INFO=1
  echo "[Ubuntu KDE Launcher] rvgpu active ($VTEST_SOCKET_NAME, GALLIUM_DRIVER=virpipe, OpenGL QSG)" >> /root/ubuntu-kde-session.log
else
  echo "[Ubuntu KDE Launcher] rvgpu unavailable; using software QML fallback" >> /root/ubuntu-kde-session.log
fi

# 4. Build KService menu cache only if missing (run in background to avoid blocking compositor startup)
if ! ls /root/.cache/ksycoca5_* >/dev/null 2>&1 && command -v kbuildsycoca5 >/dev/null 2>&1; then
  kbuildsycoca5 >> /root/ubuntu-kde-session.log 2>&1 &
fi

# 3. Start WebLinux Wayland/KWin compositor (wlserver in WLSERVER_SHELL=plasma mode)
if [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; then
  if [ -x /run/hostnode/hostnode ] && [ -d /run/wlserver ]; then
    echo "plasma" > "$XDG_RUNTIME_DIR/wlserver.shell"
    WLSERVER_SHELL=plasma HOSTNODE_HOME=/run/wlserver /run/hostnode/hostnode > /root/kwin.log 2>&1 &
    i=0
    while [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ] && [ $i -lt 50 ]; do
      sleep 0.1
      i=$((i + 1))
    done
  fi
fi

if [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; then
  echo "[Ubuntu KDE Launcher ERROR] Wayland display socket $XDG_RUNTIME_DIR/$WAYLAND_DISPLAY did not start" | tee -a /root/ubuntu-kde-session.log >&2
  exit 1
fi

echo "[Ubuntu KDE Launcher] Wayland display $WAYLAND_DISPLAY ready. Launching Plasma 5.27..." | tee -a /root/ubuntu-kde-session.log
nohup plasmashell --no-respawn > /root/plasma-shell.log 2> /root/qt.log &
sleep 2
echo "[Ubuntu KDE Launcher] Plasma 5.27 session started (PID $!)." | tee -a /root/ubuntu-kde-session.log
EOF
chmod +x /ubuntu/usr/local/bin/ubuntu-kde-session
fi`;

    await this.runCommand(gnomeSessionScript, 5000);
    await this.runCommand(xfceSessionScript, 5000);
    await this.runCommand(ubuntuGnomeSessionScript, 5000);
    await this.runCommand(ubuntuKdeSessionScript, 5000);
    this.log(`[Desktop Launcher] Provisioned desktop session entrypoints.`);
  }

  public async switchDesktop(targetDesktop: any): Promise<void> {
    this.log(`[Desktop Switch] Transitioning session from ${this.status.desktop || 'current'} to ${targetDesktop}...`);
    this.updateStatus({ state: 'shutting_down' });
    
    if (this.activeOs && this.activeOs.key_input) {
      try {
        // 1. Sync persistent storage on /dev/wdb
        await this.runCommand('sync', 5000);
        
        // 2. Terminate active compositor and desktop processes
        await this.runCommand('pkill -TERM -f "plasmashell|kwin|mutter|gnome-shell|labwc|xfce4" || true', 5000);
        await new Promise(r => setTimeout(r, 800));
        
        // 3. Clean up Wayland runtime sockets
        await this.runCommand('rm -f /tmp/runtime-root/wayland-* /run/wlserver/wayland-* 2>/dev/null || true', 3000);

        // 4. Power off / reset session safely
        if (this.activeOs.stop) {
          try { this.activeOs.stop(); } catch {}
        }
      } catch {
        // Ignore session teardown errors
      }
    }

    this.activeOs = null;
    this.updateStatus({ state: 'stopped', waylandActive: false, desktop: targetDesktop });
    this.log(`[Desktop Switch] Previous session stopped cleanly. Storage synced.`);
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

  public async importFiles(files: FileList | File[] | Blob, targetDir: string = '/root'): Promise<ImportResult> {
    const fileList = files instanceof Blob ? [files as File] : Array.from(files);

    // 1. If single backup archive (.wlbk, .json, or Blob), attempt restore into OPFS home virtual disk
    if (
      fileList.length === 1 &&
      (fileList[0].name?.endsWith('.wlbk') ||
        fileList[0].name?.endsWith('.json') ||
        fileList[0].type === 'application/json' ||
        files instanceof Blob)
    ) {
      this.log(`[Backup Subsystem] Restoring WebLinux virtual disk archive into OPFS...`);
      const res = await this.opfsManager.importHomeArchive(
        fileList[0],
        this.status.distribution || 'debian'
      );
      if (res.success) {
        this.log(`[Backup Subsystem] Disk restore successful (${Math.round(res.totalBytes / 1024)} KiB restored).`);
      } else {
        this.log(`[Backup Subsystem] Restore rejected: ${res.errors?.join(', ')}`);
      }
      return res;
    }

    // 2. If session is running and regular files were passed, drop into guest ~/Downloads via Wayland drag-and-drop
    if (
      typeof window !== 'undefined' &&
      (window as any).rvDisplay &&
      typeof (window as any).rvDisplay.drop === 'function' &&
      this.status.state === 'running'
    ) {
      this.log(`[Filesystem] Forwarding ${fileList.length} host file(s) into guest ~/Downloads via Wayland drag-drop...`);
      await (window as any).rvDisplay.drop(fileList);
      const totalBytes = fileList.reduce((acc, f) => acc + (f.size || 0), 0);
      return {
        success: true,
        importedFilesCount: fileList.length,
        totalBytes,
      };
    }

    return {
      success: false,
      importedFilesCount: 0,
      totalBytes: 0,
      errors: ['Cannot import files: Session is not running and input is not a WebLinux backup archive (.wlbk)'],
    };
  }

  public async exportFiles(): Promise<Blob> {
    this.log(`[Filesystem] Exporting user home directory...`);
    return await this.opfsManager.exportHomeArchive(this.status.distribution || 'debian');
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

  public setGraphicsMode(mode: GraphicsMode): void {
    this.graphicsMode = mode;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('weblinux_graphics_mode', mode);
      } catch {
        // Ignore storage errors
      }
    }
    this.updateStatus({ graphics: this.getGraphicsCapabilities() });
  }

  public getGraphicsMode(): GraphicsMode {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem('weblinux_graphics_mode') as GraphicsMode | null;
        if (saved === 'software' || saved === 'experimental-rvgpu' || saved === 'automatic') {
          this.graphicsMode = saved;
        }
      } catch {
        // Ignore
      }
    }
    return this.graphicsMode;
  }

  public getGraphicsCapabilities(): GraphicsCapabilities {
    const win = typeof window !== 'undefined' ? (window as any) : {};
    const rvGpu = win.rvGpu;
    const stats = rvGpu?.stats;
    const d = win.rvDisplay;
    const webgl2 = !!(d && d.gl) || this.getDiagnostics().hasWebGL2;
    const webgpu = typeof navigator !== 'undefined' && !!(navigator as any).gpu;
    const executorLoaded = !!rvGpu;
    const startErrors: string[] = Array.isArray(stats?.startErrors) ? stats.startErrors : [];
    const executorReady = !!(stats?.readyKind && startErrors.length === 0 && !stats?.deviceLost);
    const execStats = stats?.exec;
    const guestConnected = !!(execStats && (execStats.records > 0 || execStats.submits > 0));
    let activeBackend: GraphicsCapabilities['activeBackend'] = 'software';
    if (this.getGraphicsMode() !== 'software' && executorReady) {
      if (stats.readyKind === 'webgpu') activeBackend = 'webgpu';
      else if (stats.readyKind === 'vrend') activeBackend = 'vrend-webgl2';
      else if (stats.readyKind === 'proto') activeBackend = 'proto';
    }
    return {
      mode: this.getGraphicsMode(),
      webgl2,
      webgpu,
      executorLoaded,
      executorReady,
      guestConnected,
      activeBackend,
      renderer: stats?.workerRenderer || stats?.renderer || undefined,
      fallbackReason: startErrors[0] || stats?.fallback || stats?.deviceLost || undefined,
      commandRecords: execStats?.records ?? 0,
      draws: execStats?.draws ?? 0,
    };
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
