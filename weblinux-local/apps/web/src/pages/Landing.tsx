import React from 'react';
import {
  Terminal,
  Cpu,
  HardDrive,
  Shield,
  Layers,
  ArrowRight,
  Zap,
  Play,
  Monitor,
  CheckCircle,
  Clock,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { DistributionManifest } from '../../../../runtime/types';

interface LandingProps {
  onLaunch: () => void;
  onSelectDistro: (distroId: string) => void;
  manifests: DistributionManifest[];
}

export const Landing: React.FC<LandingProps> = ({
  onLaunch,
  onSelectDistro,
  manifests,
}) => {
  return (
    <div className="relative overflow-hidden">
      {/* Background ambient glowing gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-purple-600/15 via-blue-600/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[600px] right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-3xl pointer-events-none -z-10" />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pt-16 pb-20 text-center">
        {/* Release Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 mb-8 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-xs font-medium text-slate-300">
            Phase 0 & 1 Operational: Genuine Client-Side Linux via WebAssembly
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
        </div>

        {/* Master Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 max-w-4xl mx-auto leading-[1.1]">
          Your Linux. Your Browser.{' '}
          <span className="gradient-text">No Installation.</span>
        </h1>

        {/* Subhead */}
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Launch a genuine graphical Linux desktop directly in your browser tab.
          Running locally on your computer’s CPU and GPU via WebAssembly, Wayland, and OPFS.
          Zero remote servers. No account required.
        </p>

        {/* Primary CTA Cluster */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-16">
          <button
            onClick={onLaunch}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-xl shadow-purple-600/30 hover:shadow-purple-600/50 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            Launch WebLinux
          </button>

          <a
            href="#distributions"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-medium text-slate-300 bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all cursor-pointer"
          >
            <Layers className="w-5 h-5 text-purple-400" />
            Explore Catalogue
          </a>
        </div>

        {/* Visual Architecture Showcase Card */}
        <div className="max-w-5xl mx-auto rounded-2xl glass-panel-elevated p-4 sm:p-6 border border-white/10 text-left overflow-hidden">
          {/* Mock Window Titlebar */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 text-xs font-mono text-slate-400">
                WebLinux Architecture Inspector — Client-Side Execution Boundary
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
              <span>NOMMU Wasm64 Kernel</span>
            </div>
          </div>

          {/* Interactive Flow Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2">
            <div className="bg-[#121522] rounded-xl p-4 border border-white/5 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white">Browser Hardware</h3>
              <p className="text-xs text-slate-400">
                Executes via WebAssembly threads, Web Workers, and WebGL2/WebGPU on your machine.
              </p>
            </div>

            <div className="bg-[#121522] rounded-xl p-4 border border-white/5 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Terminal className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white">Linux Kernel</h3>
              <p className="text-xs text-slate-400">
                Real Linux compiled to 64-bit WebAssembly with multi-core thread scheduling.
              </p>
            </div>

            <div className="bg-[#121522] rounded-xl p-4 border border-white/5 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Monitor className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white">Wayland & Plasma</h3>
              <p className="text-xs text-slate-400">
                Real KDE Plasma 6 shell and Wayland compositor rendering directly to canvas.
              </p>
            </div>

            <div className="bg-[#121522] rounded-xl p-4 border border-white/5 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <HardDrive className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white">OPFS Ext4 Disks</h3>
              <p className="text-xs text-slate-400">
                On-demand 1 MiB chunked ext4 filesystem persisted in browser local storage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Distribution Catalogue Section */}
      <section id="distributions" className="max-w-7xl mx-auto px-4 lg:px-8 py-20 border-t border-white/5">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Layers className="w-4 h-4" />
              <span>Distribution Catalogue</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Honest Operating System Portfolio
            </h2>
          </div>
          <p className="text-slate-400 text-sm max-w-md mt-4 md:mt-0">
            We adhere to strict engineering verification: only distributions with validated boot images and ext4 filesystems are advertised as operational.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {manifests.map((distro) => {
            const isValidated = distro.validationStatus === 'validated';
            const isLaunchable = isValidated || distro.id === 'ubuntu';
            return (
              <div
                key={distro.id}
                className={`relative rounded-2xl glass-panel p-6 border transition-all duration-300 flex flex-col justify-between ${
                  isValidated
                    ? 'border-purple-500/40 hover:border-purple-500/80 hover:shadow-xl hover:shadow-purple-500/10'
                    : 'border-white/5 opacity-85 hover:opacity-100 hover:border-white/15'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-xl font-bold">
                      {distro.id === 'debian' ? '🌀' :
                       distro.id === 'ubuntu' ? '🟠' :
                       distro.id === 'fedora' ? '🔵' :
                       distro.id === 'arch' ? '🏹' : '🐉'}
                    </div>

                    <span
                      className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full border ${
                        isValidated
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {isValidated ? 'Validated Image' : 'Experimental Port'}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1">{distro.name}</h3>
                  <p className="text-xs font-mono text-purple-400 mb-3">{distro.architecture} • {distro.packageManager}</p>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{distro.notes}</p>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div>
                      <span className="text-slate-400">Default Desktop:</span>
                      <p className="font-semibold text-slate-300 capitalize">{distro.defaultDesktop}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Kernel:</span>
                      <p className="font-semibold text-slate-300 font-mono text-[10px]">{distro.kernelCompatibility}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (isValidated) {
                        onSelectDistro(distro.id);
                        onLaunch();
                      } else if (distro.id === 'ubuntu') {
                        onSelectDistro(distro.id);
                      }
                    }}
                    disabled={!isLaunchable}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      isLaunchable
                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 cursor-pointer active:scale-95'
                        : 'bg-white/5 text-slate-400 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    {isValidated ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Select & Launch Desktop
                      </>
                    ) : distro.id === 'ubuntu' ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Configure & Launch Ubuntu
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        Under Active Porting
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-20 border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Zero Server Virtual Machines</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Every process, system call, and pixel composite runs on your computer. Your files and computation never leave your browser sandbox.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Browser-Local OPFS Persistence</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your home directory and file changes survive browser reloads using the Origin Private File System. Full archive export and import included.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Offline-First Safety Boundary</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Runs 100% offline by default. Optional networking enforces strict domain allowlisting and blocks private address probing.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
