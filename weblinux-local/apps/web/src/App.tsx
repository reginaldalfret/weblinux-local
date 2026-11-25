import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Landing } from './pages/Landing';
import { Compatibility } from './pages/Compatibility';
import { DistributionSelector } from './pages/DistributionSelector';
import { DesktopSelector } from './pages/DesktopSelector';
import { BootScreen } from './pages/BootScreen';
import { Desktop } from './pages/Desktop';
import { StorageManagement } from './pages/StorageManagement';
import { BackupRestore } from './pages/BackupRestore';
import { Documentation } from './pages/Documentation';

import {
  DistributionId,
  DesktopEnvironmentId,
  DistributionManifest,
  RuntimeStatus,
} from '../../../runtime/types';
import { WasmLinuxAdapter } from '../../../runtime/adapters/WasmLinuxAdapter';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('landing');
  const [selectedDistro, setSelectedDistro] = useState<DistributionId>('debian');
  const [selectedDesktop, setSelectedDesktop] = useState<DesktopEnvironmentId>('kde-plasma');
  const [manifests, setManifests] = useState<DistributionManifest[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>({
    state: 'uninitialized',
    uptimeSeconds: 0,
    allocatedMemoryMB: 0,
    workerCount: 0,
    storageUsageBytes: 0,
    networkConnected: false,
  });
  const [logs, setLogs] = useState<string[]>([]);

  const adapter = WasmLinuxAdapter.getInstance();

  // Load distribution manifests
  useEffect(() => {
    const distroIds: DistributionId[] = ['debian', 'ubuntu', 'fedora', 'arch', 'kali-lab'];
    Promise.allSettled(distroIds.map(id => adapter.loadManifest(id)))
      .then(results => {
        const loaded: DistributionManifest[] = [];
        for (const res of results) {
          if (res.status === 'fulfilled') {
            loaded.push(res.value);
          } else {
            console.warn('[Manifest Pipeline] A manifest failed to load independently:', res.reason);
          }
        }
        setManifests(loaded);
      })
      .catch(err => {
        console.error('Failed to load manifests:', err);
      });

    // Subscribe to runtime status and logs
    const unsubStatus = adapter.onStateChange(status => {
      setRuntimeStatus(status);
      if (status.state === 'running' || status.state === 'desktop_ready') {
        setCurrentPage('desktop');
      } else if (status.state === 'stopped') {
        setCurrentPage('landing');
      }
    });

    const unsubLogs = adapter.onLogMessage(msg => {
      setLogs(prev => [...prev.slice(-300), msg]);
    });

    return () => {
      unsubStatus();
      unsubLogs();
    };
  }, []);

  const handleLaunch = async () => {
    try {
      setCurrentPage('boot');
      setLogs([]);

      // Allow microtask/render cycle so #screen and #display are in DOM
      await new Promise(r => setTimeout(r, 60));

      // 1. Initialize runtime
      await adapter.initialize();

      // 2. Load chosen manifest
      const manifestId =
        selectedDistro === 'ubuntu' && selectedDesktop === 'ubuntu-gnome'
          ? 'ubuntu-gnome'
          : selectedDistro === 'ubuntu' && selectedDesktop === 'ubuntu-kde'
          ? 'ubuntu-kde'
          : selectedDistro;
      const activeManifest = await adapter.loadManifest(manifestId as DistributionId);

      // Check validation policy: do not allow booting placeholder or unvalidated images
      if (
        activeManifest.validationStatus !== 'validated' &&
        activeManifest.id !== 'ubuntu' &&
        activeManifest.id !== 'ubuntu-gnome' &&
        activeManifest.id !== 'ubuntu-kde'
      ) {
        throw new Error(
          `${activeManifest.name} is currently an unvalidated port (status: ${activeManifest.validationStatus.toUpperCase()}). To protect your environment, only validated distributions (Debian GNU/Linux 13) can be launched.`
        );
      }

      // 3. Pre-flight download assets and cryptographically verify SHA-256
      await adapter.downloadAssets(activeManifest);

      // 4. Boot kernel
      const screenCanvas = (document.getElementById('screen') as HTMLCanvasElement) || document.createElement('canvas');
      const displayContainer = document.getElementById('display') || document.createElement('div');

      const targetDesktop = selectedDesktop;

      await adapter.boot({
        manifest: activeManifest,
        desktop: targetDesktop,
        enableAudio: true,
        enableNetworking: false, // Safe offline by default
        enableGpu: true,
        gpuExecutor: 'vrend',
        autostartDesktop: targetDesktop !== 'cli',
        screenCanvas,
        displayContainer,
      });

    } catch (err: any) {
      console.error('Launch sequence encountered an error:', err);
      // BootScreen will display error log
    }
  };

  const handleShutdown = async () => {
    await adapter.shutdown();
  };

  const currentManifest = manifests.find(m => m.id === selectedDistro) || {
    id: 'debian',
    name: 'Debian GNU/Linux (Trixie)',
    releaseVersion: '13 / trixie',
    architecture: 'riscv64',
    kernelCompatibility: 'linux-wasm64_nommu-6.1',
    defaultDesktop: 'kde-plasma',
    supportedDesktops: ['kde-plasma', 'gnome', 'xfce'],
    packageManager: 'apt',
    filesystemLayout: { rootMount: '/debian', homeMount: '/root' },
    imageSource: {
      baseUri: 'https://disk.plasmaontheweb.com/disk/',
      chunkSize: 1048576,
      totalSizeBytes: 8589934592,
      id: '21dd6321337e178c4ac19c27d790403a',
    },
    integrity: { chunksCount: 8192 },
    runtimeRequirements: {
      minMemoryMB: 4096,
      recommendedMemoryMB: 8192,
      minCores: 4,
      recommendedCores: 8,
      requiresSharedArrayBuffer: true,
      requiresCrossOriginIsolated: true,
      requiresWebGL2: true,
      requiresOPFS: true,
      estimatedDiskMB: 2048,
    },
    licensing: {
      baseLicense: 'GPL-2.0-or-later',
      redistributionAllowed: true,
      licenseDocUrl: '/docs/LICENSING.md',
    },
    validationStatus: 'validated',
    notes: 'Primary validated tier.',
  };

  return (
    <div className={`flex flex-col bg-[#090a0f] text-slate-100 ${currentPage === 'desktop' ? 'h-screen w-screen overflow-hidden' : 'min-h-screen'}`}>
      {/* Navbar: hidden when in active full desktop session */}
      {currentPage !== 'desktop' && (
        <Navbar
          currentPage={currentPage}
          onNavigate={(page) => setCurrentPage(page)}
          onLaunch={handleLaunch}
          runtimeState={runtimeStatus.state}
        />
      )}

      {/* Main Page Content */}
      <main className="flex-1 flex flex-col">
        {currentPage === 'landing' && (
          <Landing
            onLaunch={handleLaunch}
            onSelectDistro={(id) => {
              setSelectedDistro(id as DistributionId);
              if (id === 'ubuntu') setSelectedDesktop('cli');
              setCurrentPage('desktops');
            }}
            manifests={manifests}
          />
        )}

        {currentPage === 'compatibility' && <Compatibility />}

        {currentPage === 'distributions' && (
          <DistributionSelector
            manifests={manifests}
            selectedDistro={selectedDistro}
            onSelect={(id) => {
              setSelectedDistro(id);
              if (id === 'ubuntu') setSelectedDesktop('cli');
            }}
            onProceed={() => setCurrentPage('desktops')}
          />
        )}

        {currentPage === 'desktops' && (
          <DesktopSelector
            selectedDistro={selectedDistro}
            selectedDesktop={selectedDistro === 'ubuntu' ? 'cli' : selectedDesktop}
            onSelect={(id) => setSelectedDesktop(id)}
            onLaunch={handleLaunch}
          />
        )}

        {/* Persistent Desktop / Boot Viewport */}
        {(currentPage === 'boot' || currentPage === 'desktop') && (
          <div className="relative flex-1 w-full h-full flex flex-col overflow-hidden">
            {currentPage === 'boot' && (
              <div className="absolute inset-0 z-50 bg-[#090a0f] overflow-y-auto">
                <BootScreen
                  manifest={currentManifest}
                  desktop={selectedDistro === 'ubuntu' ? 'cli' : selectedDesktop}
                  runtimeStatus={runtimeStatus}
                  logs={logs}
                  onCancel={handleShutdown}
                />
              </div>
            )}
            <Desktop
              manifest={currentManifest}
              desktop={selectedDistro === 'ubuntu' ? 'cli' : selectedDesktop}
              runtimeStatus={runtimeStatus}
              onShutdown={handleShutdown}
              logs={logs}
            />
          </div>
        )}

        {currentPage === 'storage' && <StorageManagement />}

        {currentPage === 'backup' && <BackupRestore />}

        {currentPage === 'docs' && <Documentation />}
      </main>

      {/* Footer: hidden during full desktop view */}
      {currentPage !== 'desktop' && currentPage !== 'boot' && <Footer />}
    </div>
  );
};
