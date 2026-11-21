/**
 * WebLinux Local - Core Runtime Engine Types & Interfaces
 * Provides an independent abstraction layer over the underlying WebAssembly Linux kernel.
 */

export type DistributionId = 'debian' | 'ubuntu' | 'fedora' | 'arch' | 'kali-lab';

export type DesktopEnvironmentId = 'kde-plasma' | 'icewm' | 'xfce' | 'gnome';

export type ValidationStatus = 'validated' | 'experimental' | 'planned' | 'testing';

export interface RuntimeRequirements {
  minMemoryMB: number;
  recommendedMemoryMB: number;
  minCores: number;
  recommendedCores: number;
  requiresSharedArrayBuffer: boolean;
  requiresCrossOriginIsolated: boolean;
  requiresWebGL2: boolean;
  requiresWebGPU?: boolean;
  requiresOPFS: boolean;
  estimatedDiskMB: number;
}

export interface DistributionManifest {
  id: DistributionId;
  name: string;
  releaseVersion: string;
  architecture: 'riscv64' | 'wasm64' | 'x86_64';
  kernelCompatibility: string;
  defaultDesktop: DesktopEnvironmentId;
  supportedDesktops: DesktopEnvironmentId[];
  packageManager: 'apt' | 'dnf' | 'pacman' | 'none';
  filesystemLayout: {
    rootMount: string;
    homeMount: string;
    sharedMount?: string;
  };
  imageSource: {
    baseUri: string;
    chunkSize: number;
    totalSizeBytes: number;
    manifestUri?: string;
    id: string;
  };
  integrity: {
    kernelSha256?: string;
    initrdSha256?: string;
    chunksCount: number;
    hashes?: string[];
  };
  runtimeRequirements: RuntimeRequirements;
  licensing: {
    baseLicense: string;
    redistributionAllowed: boolean;
    licenseDocUrl: string;
  };
  validationStatus: ValidationStatus;
  notes: string;
}

export interface BootOptions {
  manifest: DistributionManifest;
  desktop: DesktopEnvironmentId;
  memoryMB?: number;
  cpuPool?: number;
  enableAudio: boolean;
  enableNetworking: boolean;
  networkRelayUri?: string;
  enableGpu: boolean;
  gpuExecutor: 'vrend' | 'webgpu' | 'auto' | 'off';
  freshRootDisk?: boolean;
  freshHomeDisk?: boolean;
  autostartDesktop: boolean;
  screenCanvas: HTMLCanvasElement;
  displayContainer: HTMLElement;
  customKernelArgs?: string;
}

export type RuntimeState = 'uninitialized' | 'initializing' | 'ready' | 'downloading' | 'booting' | 'running' | 'paused' | 'shutting_down' | 'stopped' | 'error';

export interface RuntimeStatus {
  state: RuntimeState;
  uptimeSeconds: number;
  distribution?: DistributionId;
  desktop?: DesktopEnvironmentId;
  allocatedMemoryMB: number;
  workerCount: number;
  storageUsageBytes: number;
  networkConnected: boolean;
  error?: string;
}

export interface DownloadProgress {
  assetName: string;
  loadedBytes: number;
  totalBytes: number;
  percentage: number;
  activeChunkIndex?: number;
  totalChunks?: number;
}

export interface StorageUsageInfo {
  isPersistentGranted: boolean;
  quotaBytes: number;
  usageBytes: number;
  usagePercentage: number;
  opfsSupported: boolean;
  disks: {
    name: string;
    type: 'system' | 'home' | 'cache';
    bytes: number;
  }[];
}

export interface ImportResult {
  success: boolean;
  importedFilesCount: number;
  totalBytes: number;
  errors?: string[];
}

export interface IRuntimeAdapter {
  initialize(): Promise<void>;
  loadManifest(manifestIdOrUri: DistributionId | string): Promise<DistributionManifest>;
  downloadAssets(manifest: DistributionManifest, onProgress?: (p: DownloadProgress) => void): Promise<void>;
  boot(options: BootOptions): Promise<void>;
  shutdown(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getStatus(): RuntimeStatus;
  sendInput(input: string): void;
  importFiles(files: FileList | File[], targetDir: string): Promise<ImportResult>;
  exportFiles(path?: string): Promise<Blob>;
  getStorageUsage(): Promise<StorageUsageInfo>;
  resetStorage(diskName?: string): Promise<void>;
  onStateChange(listener: (status: RuntimeStatus) => void): () => void;
  onLogMessage(listener: (log: string) => void): () => void;
}
