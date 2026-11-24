/**
 * WebLinux Local - Core Runtime Engine Types & Interfaces
 * Provides an independent abstraction layer over the underlying WebAssembly Linux kernel.
 */

export type DistributionId = 'debian' | 'ubuntu' | 'fedora' | 'arch' | 'kali-lab' | 'ubuntu-gnome';

export type DesktopEnvironmentId = 'kde-plasma' | 'gnome' | 'xfce' | 'cli' | 'ubuntu-gnome';

export type DesktopProfileStatus = 'validated' | 'experimental' | 'preview' | 'unavailable';

export interface DesktopProfile {
  id: DesktopEnvironmentId;
  name: string;
  version: string;
  tagline: string;
  description: string;
  distributionId: DistributionId;
  status: DesktopProfileStatus;
  sessionCommand: string;
  compositor: string;
  rootfsManifestId: string;
  minimumRamMB: number;
  recommendedRamMB: number;
  supportedFeatures: string[];
  knownLimitations: string[];
  previewImage?: string;
}

export type ValidationStatus = 'validated' | 'preview' | 'experimental' | 'planned' | 'testing';

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
    initrdUncompressedSha256?: string;
    kernelSize?: number;
    initrdSize?: number;
    initrdUncompressedSize?: number;
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

export type RuntimeState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'downloading'
  | 'booting'
  | 'shell_ready'
  | 'compositor_starting'
  | 'desktop_ready'
  | 'running'
  | 'paused'
  | 'shutting_down'
  | 'stopped'
  | 'error';

export interface RuntimeStatus {
  state: RuntimeState;
  uptimeSeconds: number;
  distribution?: DistributionId;
  desktop?: DesktopEnvironmentId;
  allocatedMemoryMB: number;
  workerCount: number;
  storageUsageBytes: number;
  networkConnected: boolean;
  waylandActive?: boolean;
  shellReady?: boolean;
  error?: string;
}

export interface CommandResult {
  rc: number | null;
  ms: number;
  out: string;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  executionTimeMs?: number;
  timedOut?: boolean;
}

export interface RuntimeDiagnostics {
  crossOriginIsolated: boolean;
  hasSharedArrayBuffer: boolean;
  hasWebAssembly: boolean;
  hasWebGL2: boolean;
  hasWebGPU: boolean;
  hasOPFS: boolean;
  deviceMemoryGB: number;
  hardwareConcurrency: number;
  activeWorkers: number;
  waylandActive: boolean;
  lastError?: string;
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
  getDiagnostics(): RuntimeDiagnostics;
  sendInput(input: string): void;
  runCommand(command: string, timeoutMs?: number): Promise<CommandResult>;
  getOutput(): string;
  isWaylandActive(): boolean;
  importFiles(files: FileList | File[] | Blob, targetDir?: string): Promise<ImportResult>;
  exportFiles(path?: string): Promise<Blob>;
  getStorageUsage(): Promise<StorageUsageInfo>;
  resetStorage(diskName?: string): Promise<void>;
  onStateChange(listener: (status: RuntimeStatus) => void): () => void;
  onLogMessage(listener: (log: string) => void): () => void;
}
