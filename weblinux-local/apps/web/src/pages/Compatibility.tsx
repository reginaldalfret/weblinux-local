import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Layers,
  HardDrive,
  Info,
  ExternalLink,
} from 'lucide-react';

interface CheckItem {
  id: string;
  name: string;
  category: 'core' | 'graphics' | 'storage' | 'system';
  status: 'passed' | 'warning' | 'failed' | 'checking';
  details: string;
  recommendation?: string;
}

export const Compatibility: React.FC = () => {
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [isRunning, setIsRunning] = useState(true);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: CheckItem[] = [];

    // 1. WebAssembly Support
    const hasWasm = typeof WebAssembly !== 'undefined';
    results.push({
      id: 'wasm',
      name: 'WebAssembly (Wasm) Engine',
      category: 'core',
      status: hasWasm ? 'passed' : 'failed',
      details: hasWasm ? 'WebAssembly is fully supported.' : 'Your browser does not support WebAssembly.',
      recommendation: hasWasm ? undefined : 'Upgrade to a modern version of Chrome, Edge, or Brave.',
    });

    // 2. SharedArrayBuffer
    const hasSAB = typeof SharedArrayBuffer !== 'undefined';
    results.push({
      id: 'sab',
      name: 'SharedArrayBuffer (Shared Memory)',
      category: 'core',
      status: hasSAB ? 'passed' : 'failed',
      details: hasSAB
        ? 'SharedArrayBuffer is available for kernel Web Worker multi-threading.'
        : 'SharedArrayBuffer is disabled or blocked by security policies.',
      recommendation: hasSAB
        ? undefined
        : 'Requires Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp headers.',
    });

    // 3. crossOriginIsolated
    const isIsolated = typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false;
    results.push({
      id: 'coi',
      name: 'Cross-Origin Isolation (COOP/COEP)',
      category: 'core',
      status: isIsolated ? 'passed' : 'failed',
      details: isIsolated
        ? 'Page context is cross-origin isolated. High-resolution timers and threads are unlocked.'
        : 'Page context is not isolated. Thread synchronization primitives cannot execute.',
      recommendation: isIsolated
        ? undefined
        : 'Ensure you are accessing WebLinux over HTTPS or localhost with COOP/COEP enabled.',
    });

    // 4. WebGL2
    let hasWebGL2 = false;
    try {
      const canvas = document.createElement('canvas');
      hasWebGL2 = !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
    } catch (e) {
      hasWebGL2 = false;
    }
    results.push({
      id: 'webgl2',
      name: 'WebGL 2.0 Hardware Graphics',
      category: 'graphics',
      status: hasWebGL2 ? 'passed' : 'failed',
      details: hasWebGL2
        ? 'WebGL 2.0 context created successfully for Wayland surface presentation.'
        : 'WebGL 2.0 is unavailable. Hardware-accelerated graphics cannot render.',
      recommendation: hasWebGL2
        ? undefined
        : 'Enable hardware acceleration in browser settings or update GPU drivers.',
    });

    // 5. WebGPU
    let hasWebGPU = false;
    if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        hasWebGPU = !!adapter;
      } catch (e) {
        hasWebGPU = false;
      }
    }
    results.push({
      id: 'webgpu',
      name: 'WebGPU Next-Gen Graphics API',
      category: 'graphics',
      status: hasWebGPU ? 'passed' : 'warning',
      details: hasWebGPU
        ? 'WebGPU is available for high-performance direct GPU command execution (?exec=webgpu).'
        : 'WebGPU is not enabled in this browser. Fallback to WebGL2 / virgl will be utilized.',
      recommendation: hasWebGPU
        ? undefined
        : 'Optional for KDE Plasma 6. Supported in modern Chrome and Edge on desktop.',
    });

    // 6. OPFS (Origin Private File System)
    const hasOPFS = typeof navigator !== 'undefined' &&
                    !!navigator.storage &&
                    typeof navigator.storage.getDirectory === 'function';
    results.push({
      id: 'opfs',
      name: 'Origin Private File System (OPFS)',
      category: 'storage',
      status: hasOPFS ? 'passed' : 'failed',
      details: hasOPFS
        ? 'OPFS is supported. Persistent ext4 disk chunks can be cached and modified.'
        : 'OPFS is not supported. File changes cannot be persisted across sessions.',
      recommendation: hasOPFS
        ? undefined
        : 'Use a desktop version of Chromium, Chrome, Edge, or Brave.',
    });

    // 7. Persistent Storage Permission
    let isPersisted = false;
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      try {
        isPersisted = await navigator.storage.persisted();
      } catch (e) {}
    }
    results.push({
      id: 'storage_persist',
      name: 'Browser Storage Durability',
      category: 'storage',
      status: isPersisted ? 'passed' : 'warning',
      details: isPersisted
        ? 'Storage is marked persistent. The browser will not evict Linux disks under low disk space.'
        : 'Storage is currently best-effort. Browser may purge cache if disk space runs critically low.',
      recommendation: isPersisted
        ? undefined
        : 'You can request persistent durability from the Storage Management page.',
    });

    // 8. Hardware Concurrency & Memory
    const concurrency = navigator.hardwareConcurrency || 1;
    const deviceMem = (navigator as any).deviceMemory || 4;
    const hasAdequateHardware = concurrency >= 4 && deviceMem >= 4;

    results.push({
      id: 'hardware',
      name: 'Host Hardware Capacity (Cores & RAM)',
      category: 'system',
      status: hasAdequateHardware ? 'passed' : concurrency >= 2 ? 'warning' : 'failed',
      details: `Detected ~${deviceMem} GB estimated memory and ${concurrency} logical CPU cores.`,
      recommendation: hasAdequateHardware
        ? undefined
        : 'Recommended: 8+ GB RAM and 4+ CPU cores for smooth KDE Plasma desktop execution.',
    });

    // 9. Browser Architecture (Desktop vs Mobile)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    results.push({
      id: 'platform',
      name: 'Desktop Operating System Target',
      category: 'system',
      status: !isMobile ? 'passed' : 'warning',
      details: !isMobile
        ? `Running on verified desktop platform (${navigator.platform || 'Desktop'}).`
        : 'Mobile browser detected. Phones and tablets are currently experimental and unoptimized.',
      recommendation: !isMobile ? undefined : 'Use a desktop computer with a physical keyboard and mouse.',
    });

    setChecks(results);
    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const passedCount = checks.filter((c) => c.status === 'passed').length;
  const warningCount = checks.filter((c) => c.status === 'warning').length;
  const failedCount = checks.filter((c) => c.status === 'failed').length;

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Hardware & Environment Preflight</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Browser Compatibility Checker
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Validating browser capabilities required for local client-side Linux execution.
          </p>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-slate-200 transition-all cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
          Re-run Verification
        </button>
      </div>

      {/* Summary Score Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-emerald-400">Passed Checks</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold text-white">{passedCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">Core requirements met</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.03]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-400">Warnings / Fallbacks</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-extrabold text-white">{warningCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">Non-critical or optional features</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.03]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-rose-400">Critical Blockers</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-3xl font-extrabold text-white">{failedCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">Preventing live boot</p>
        </div>
      </div>

      {/* Check Items Grid */}
      <div className="space-y-3">
        {checks.map((item) => (
          <div
            key={item.id}
            className="glass-panel p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {item.status === 'passed' && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
                {item.status === 'warning' && (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                )}
                {item.status === 'failed' && (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-400">
                    {item.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{item.details}</p>
                {item.recommendation && (
                  <p className="text-xs text-amber-300/90 mt-1 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>Action: {item.recommendation}</span>
                  </p>
                )}
              </div>
            </div>

            <span
              className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full border self-start sm:self-center shrink-0 ${
                item.status === 'passed'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : item.status === 'warning'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>

      {/* Browser Guidance Note */}
      <div className="mt-10 p-5 rounded-2xl glass-panel border border-white/10 text-xs text-slate-300 space-y-2">
        <h4 className="font-semibold text-white flex items-center gap-1.5 text-sm">
          <Info className="w-4 h-4 text-purple-400" />
          Recommended Browser Configuration
        </h4>
        <p className="leading-relaxed">
          For full performance and security isolation, run WebLinux Local on a recent desktop version of Google Chrome, Microsoft Edge, or Brave Browser. Firefox handles WebAssembly multithreading with custom flags but may exhibit differences in AudioWorklet and OPFS access handle behaviors.
        </p>
      </div>
    </div>
  );
};
