import React from 'react';
import { Monitor, CheckCircle2, Zap, ArrowRight, Layers, Sparkles, AlertCircle } from 'lucide-react';
import { DesktopEnvironmentId } from '../../../../runtime/types';

interface DesktopOption {
  id: DesktopEnvironmentId;
  name: string;
  tagline: string;
  description: string;
  status: 'validated' | 'future_target';
  memoryRecommendedMB: number;
  engine: string;
  features: string[];
}

const DESKTOPS: DesktopOption[] = [
  {
    id: 'kde-plasma',
    name: 'KDE Plasma 6',
    tagline: 'Primary Complete Desktop Environment',
    description: 'Full-featured modern desktop shell compiled natively to WebAssembly (Qt 6.8 & KDE Frameworks 6). Runs Konsole, Dolphin, Kate, System Settings with zero emulation latency for the shell.',
    status: 'validated',
    memoryRecommendedMB: 8192,
    engine: 'Native WebAssembly Qt6 / Wayland Compositor',
    features: ['Kickoff Application Launcher', 'Dolphin File Manager', 'Konsole Terminal with IME', 'Wayland compositor protocols', 'Aurorae Window Decorations'],
  },
  {
    id: 'icewm',
    name: 'IceWM',
    tagline: 'Initial Lightweight Desktop Environment',
    description: 'Ultra-fast, minimal memory footprint X11/Wayland desktop environment. Ideal for low-spec laptops or quick system administration sessions.',
    status: 'validated',
    memoryRecommendedMB: 4096,
    engine: 'Xwayland / IceWM Window Manager',
    features: ['Instant startup time', 'Low memory overhead', 'Traditional taskbar & menu', 'X11 application compatibility', 'Minimal battery drain'],
  },
  {
    id: 'xfce',
    name: 'XFCE 4.18',
    tagline: 'Future Desktop Target',
    description: 'Fast, modular desktop environment currently undergoing GTK3/Wayland and RISC-V translation validation pipeline.',
    status: 'future_target',
    memoryRecommendedMB: 4096,
    engine: 'GTK3 / Wayland Bridge (In Progress)',
    features: ['Thunar File Manager', 'Lightweight panel system', 'Modular components', 'Low resource consumption'],
  },
  {
    id: 'gnome',
    name: 'GNOME Shell',
    tagline: 'Future Desktop Target',
    description: 'Modern workspace-centric desktop environment scheduled for future integration after libmutter WebAssembly port stabilization.',
    status: 'future_target',
    memoryRecommendedMB: 8192,
    engine: 'Mutter Wayland Compositor (Planned)',
    features: ['Overview spatial navigation', 'GTK4 & Libadwaita', 'System search integration'],
  },
];

interface DesktopSelectorProps {
  selectedDesktop: DesktopEnvironmentId;
  onSelect: (id: DesktopEnvironmentId) => void;
  onLaunch: () => void;
}

export const DesktopSelector: React.FC<DesktopSelectorProps> = ({
  selectedDesktop,
  onSelect,
  onLaunch,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Monitor className="w-4 h-4" />
            <span>Step 2 of 2: Desktop Environment Selection</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Choose Graphical Environment
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Select the desktop shell to boot. Unlike simulated web UIs, WebLinux executes genuine compiled Linux desktop environments.
          </p>
        </div>

        <button
          onClick={onLaunch}
          className="mt-4 md:mt-0 flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-xl shadow-purple-600/25 active:scale-95 transition-all cursor-pointer self-start md:self-auto"
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>Launch WebLinux Desktop</span>
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {DESKTOPS.map((desktop) => {
          const isSelected = selectedDesktop === desktop.id;
          const isValidated = desktop.status === 'validated';

          return (
            <div
              key={desktop.id}
              onClick={() => {
                if (isValidated) onSelect(desktop.id);
              }}
              className={`rounded-2xl glass-panel p-6 border transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'border-purple-500 bg-purple-500/[0.06] shadow-xl shadow-purple-500/15 ring-2 ring-purple-500/30'
                  : isValidated
                  ? 'border-white/10 hover:border-purple-500/50 hover:bg-white/[0.04]'
                  : 'border-white/5 opacity-60 cursor-not-allowed'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      {desktop.name}
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-purple-400" />}
                    </h3>
                    <p className="text-xs text-purple-300 font-medium mt-0.5">{desktop.tagline}</p>
                  </div>

                  <span
                    className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full border ${
                      isValidated
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-white/5 text-slate-400 border-white/10'
                    }`}
                  >
                    {isValidated ? 'Operational' : 'Future Target'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {desktop.description}
                </p>

                <div className="space-y-1.5 mb-4">
                  <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Features:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-300">
                    {desktop.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-white/5 text-xs">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Engine Architecture:</span>
                  <span className="font-mono text-slate-300">{desktop.engine}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Memory Requirement:</span>
                  <span className="font-semibold text-slate-300">{desktop.memoryRecommendedMB / 1024} GB</span>
                </div>

                <button
                  type="button"
                  disabled={!isValidated}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : isValidated
                      ? 'bg-white/5 text-slate-200 hover:bg-white/10'
                      : 'bg-white/5 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isSelected ? 'Active Desktop Environment' : isValidated ? 'Select This Desktop' : 'In Roadmap'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
