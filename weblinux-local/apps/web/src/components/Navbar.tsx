import React from 'react';
import { Terminal, Shield, HardDrive, BookOpen, Layers, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLaunch: () => void;
  runtimeState: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  onLaunch,
  runtimeState,
}) => {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 px-4 lg:px-8 py-3 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 p-0.5 shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all">
            <div className="w-full h-full bg-[#0c0e17] rounded-[10px] flex items-center justify-center">
              <Terminal className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white font-['JetBrains_Mono']">
                WebLinux<span className="text-purple-400 font-light">.local</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                v1.0-nommu
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">Real Browser-Executed OS Platform</p>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5">
          <button
            onClick={() => onNavigate('distributions')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentPage === 'distributions'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-400" />
            Distributions
          </button>

          <button
            onClick={() => onNavigate('desktops')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentPage === 'desktops'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Terminal className="w-4 h-4 text-blue-400" />
            Desktops
          </button>

          <button
            onClick={() => onNavigate('storage')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentPage === 'storage' || currentPage === 'backup'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <HardDrive className="w-4 h-4 text-emerald-400" />
            Storage & OPFS
          </button>

          <button
            onClick={() => onNavigate('compatibility')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentPage === 'compatibility'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Shield className="w-4 h-4 text-amber-400" />
            Compatibility
          </button>

          <button
            onClick={() => onNavigate('docs')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentPage === 'docs'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-400" />
            Architecture & GPL
          </button>
        </nav>

        {/* Status & CTA */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/5 text-xs text-slate-300">
            <span className={`w-2 h-2 rounded-full ${
              runtimeState === 'running' ? 'bg-emerald-400 animate-pulse' :
              runtimeState === 'booting' ? 'bg-amber-400 animate-pulse' :
              'bg-purple-400'
            }`} />
            <span className="capitalize">{runtimeState}</span>
          </div>

          <button
            onClick={onLaunch}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-md shadow-purple-600/25 active:scale-95 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Launch WebLinux
          </button>
        </div>
      </div>
    </header>
  );
};
