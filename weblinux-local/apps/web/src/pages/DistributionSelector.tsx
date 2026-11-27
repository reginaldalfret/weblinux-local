import React from 'react';
import { Layers, CheckCircle2, AlertCircle, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import { DistributionManifest, DistributionId } from '../../../../runtime/types';

interface DistributionSelectorProps {
  manifests: DistributionManifest[];
  selectedDistro: DistributionId;
  onSelect: (id: DistributionId) => void;
  onProceed: () => void;
}

export const DistributionSelector: React.FC<DistributionSelectorProps> = ({
  manifests,
  selectedDistro,
  onSelect,
  onProceed,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Layers className="w-4 h-4" />
            <span>Step 1 of 2: Distribution Selection</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Choose Linux Distribution
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Select a verified operating system image. Each distribution manifest specifies its exact kernel compatibility, architecture, and package management layer.
          </p>
        </div>

        <button
          onClick={onProceed}
          className="mt-4 md:mt-0 flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-600/20 active:scale-95 transition-all cursor-pointer self-start md:self-auto"
        >
          <span>Configure Desktop</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Distribution Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {manifests.map((distro) => {
          const isSelected = selectedDistro === distro.id;
          const isValidated = distro.validationStatus === 'validated';
          const isSelectable = isValidated || distro.id === 'ubuntu' || distro.id === 'debian-firefox' || distro.id === 'ubuntu-kde-epiphany' || distro.id === 'arch-kde' || distro.id === 'opensuse-tumbleweed-kde' || distro.id === 'fedora-kde' || distro.id === 'alpine-kde';

          return (
            <div
              key={distro.id}
              onClick={() => {
                if (isSelectable) onSelect(distro.id);
              }}
              className={`rounded-2xl glass-panel p-6 border transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'border-purple-500 bg-purple-500/[0.06] shadow-xl shadow-purple-500/15 ring-2 ring-purple-500/30'
                  : isSelectable
                  ? 'border-white/10 hover:border-purple-500/50 hover:bg-white/[0.04]'
                  : 'border-white/5 opacity-70 cursor-not-allowed'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-2xl">
                    {distro.id === 'debian' ? '🌀' :
                     distro.id === 'debian-firefox' ? '🌐' :
                     distro.id === 'ubuntu' ? '🟠' :
                     distro.id === 'ubuntu-kde-epiphany' ? '🌐' :
                     distro.id === 'arch-kde' ? '🏹' :
                     distro.id === 'opensuse-tumbleweed-kde' ? '🦎' :
                     distro.id === 'fedora-kde' ? '🎩' :
                     distro.id === 'alpine-kde' ? '🏔️' :
                     distro.id === 'fedora' ? '🔵' :
                     distro.id === 'arch' ? '🏹' : '🐉'}
                  </div>

                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                      isValidated
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : (distro.id === 'ubuntu' || distro.id === 'debian-firefox' || distro.id === 'ubuntu-kde-epiphany' || distro.id === 'arch-kde' || distro.id === 'opensuse-tumbleweed-kde' || distro.id === 'fedora-kde' || distro.id === 'alpine-kde')
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {isValidated ? 'Validated' : (distro.id === 'debian-firefox' || distro.id === 'ubuntu-kde-epiphany') ? 'Native Browser' : (distro.id === 'arch-kde' || distro.id === 'opensuse-tumbleweed-kde' || distro.id === 'fedora-kde' || distro.id === 'alpine-kde') ? 'Experimental KDE 6' : distro.id === 'ubuntu' ? 'Experimental CLI' : 'Experimental Port'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">{distro.name}</h3>
                <div className="flex items-center gap-2 text-xs font-mono text-purple-400 mb-3">
                  <span>{distro.architecture}</span>
                  <span>•</span>
                  <span>Release {distro.releaseVersion}</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {distro.notes}
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-white/5 text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Package Manager:</span>
                  <span className="font-mono text-slate-300 font-semibold">{distro.packageManager}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Kernel Target:</span>
                  <span className="font-mono text-slate-300 font-semibold">{distro.kernelCompatibility}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Recommended RAM:</span>
                  <span className="text-slate-300 font-semibold">{distro.runtimeRequirements.recommendedMemoryMB / 1024} GB</span>
                </div>

                <div className="pt-2">
                  <div className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white'
                      : isValidated
                      ? 'bg-white/5 text-slate-300 group-hover:bg-white/10'
                      : 'bg-white/5 text-slate-400'
                  }`}>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {isSelected ? 'Selected Active Target' : isValidated ? 'Click to Select' : 'Verification In Progress'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
