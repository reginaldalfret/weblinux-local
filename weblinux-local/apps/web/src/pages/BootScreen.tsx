import React, { useEffect, useRef } from 'react';
import { Terminal, Cpu, HardDrive, ShieldCheck, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { DistributionManifest, DesktopEnvironmentId, RuntimeStatus } from '../../../../runtime/types';

interface BootScreenProps {
  manifest: DistributionManifest;
  desktop: DesktopEnvironmentId;
  runtimeStatus: RuntimeStatus;
  logs: string[];
  onCancel: () => void;
}

export const BootScreen: React.FC<BootScreenProps> = ({
  manifest,
  desktop,
  runtimeStatus,
  logs,
  onCancel,
}) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Derive stage of boot sequence
  const isKernelLoading = logs.some(l => l.includes('Compiling kernel module'));
  const isInitrdLoading = logs.some(l => l.includes('Loading root filesystem'));
  const isKernelRunning = logs.some(l => l.includes('Launching kernel workers') || l.includes('System Online'));
  const isWaylandStarting = logs.some(l => l.includes('wlserver') || l.includes('Wayland') || l.includes('System Online'));

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Boot Sequence Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>Booting {manifest.name}</span>
            <span className="text-xs uppercase font-mono px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {desktop}
            </span>
          </h1>
        </div>

        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all cursor-pointer self-start sm:self-auto"
        >
          Cancel Boot
        </button>
      </div>

      {/* Boot Checklist Card */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Hardware & Subsystem Initialization Status
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Step 1 */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">1. Kernel Wasm</span>
              {isKernelLoading ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              )}
            </div>
            <p className="text-[11px] text-slate-400">wasm64_nommu JIT</p>
          </div>

          {/* Step 2 */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">2. Root Initrd</span>
              {isInitrdLoading ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-slate-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-400">BusyBox & rv emulator</p>
          </div>

          {/* Step 3 */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">3. OPFS Block Device</span>
              {isKernelRunning ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-slate-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-400">1 MiB sparse chunking</p>
          </div>

          {/* Step 4 */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">4. Wayland Shell</span>
              {isWaylandStarting ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-slate-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-400">WebGL2 Surface Presenter</p>
          </div>
        </div>
      </div>

      {/* Real Kernel Log Streaming Console */}
      <div className="rounded-2xl border border-white/10 bg-[#07080d] overflow-hidden shadow-2xl">
        {/* Terminal Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-mono font-medium text-slate-300">
              /dev/console & syslog stream
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Memory: {runtimeStatus.allocatedMemoryMB || 4096} MiB | Workers: {runtimeStatus.workerCount || 4}
          </span>
        </div>

        {/* Log Viewer */}
        <div className="p-4 h-96 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 leading-relaxed selection:bg-purple-500/30">
          {logs.length === 0 ? (
            <div className="text-slate-400 italic">Initializing kernel command line and allocating workers...</div>
          ) : (
            logs.map((line, idx) => (
              <div key={idx} className="whitespace-pre-wrap break-all">
                {line.startsWith('[Boot Error]') ? (
                  <span className="text-rose-400 font-semibold">{line}</span>
                ) : line.startsWith('[Kernel]') ? (
                  <span className="text-blue-300">{line}</span>
                ) : line.startsWith('[Hardware]') || line.startsWith('[Wasm Engine]') ? (
                  <span className="text-purple-300">{line}</span>
                ) : line.startsWith('[System Online]') ? (
                  <span className="text-emerald-300 font-semibold">{line}</span>
                ) : (
                  <span className="text-slate-300">{line}</span>
                )}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
};
