import React from 'react';
import { Monitor, CheckCircle2, Zap, ArrowRight, Layers, Sparkles, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import { DistributionId, DesktopEnvironmentId, DesktopProfile, DesktopProfileStatus } from '../../../../runtime/types';
import { DEBIAN_DESKTOP_PROFILES } from '../../../../runtime/profiles/desktopProfiles';

interface DesktopSelectorProps {
  selectedDistro?: DistributionId;
  selectedDesktop: DesktopEnvironmentId;
  onSelect: (id: DesktopEnvironmentId) => void;
  onLaunch: () => void;
}

export const DesktopSelector: React.FC<DesktopSelectorProps> = ({
  selectedDistro = 'debian',
  selectedDesktop,
  onSelect,
  onLaunch,
}) => {
  const isUbuntu = selectedDistro === 'ubuntu' || selectedDistro === 'ubuntu-kde-epiphany';
  const isArch = selectedDistro === 'arch-kde';
  const isOpenSuse = selectedDistro === 'opensuse-tumbleweed-kde';
  const isFedora = selectedDistro === 'fedora-kde';
  const isAlpine = selectedDistro === 'alpine-kde';
  const desktopList: DesktopProfile[] = isUbuntu
    ? [DEBIAN_DESKTOP_PROFILES['ubuntu-kde']]
    : isArch
    ? [DEBIAN_DESKTOP_PROFILES['arch-kde']]
    : isOpenSuse
    ? [DEBIAN_DESKTOP_PROFILES['opensuse-tumbleweed-kde']]
    : isFedora
    ? [DEBIAN_DESKTOP_PROFILES['fedora-kde']]
    : isAlpine
    ? [DEBIAN_DESKTOP_PROFILES['alpine-kde']]
    : Object.values(DEBIAN_DESKTOP_PROFILES).filter(p => p.id !== 'cli' && p.id !== 'ubuntu-gnome' && p.id !== 'ubuntu-kde' && p.id !== 'arch-kde' && p.id !== 'opensuse-tumbleweed-kde' && p.id !== 'fedora-kde' && p.id !== 'alpine-kde');

  const getStatusBadge = (status: DesktopProfileStatus) => {
    switch (status) {
      case 'validated':
        return {
          label: 'Validated',
          className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
        };
      case 'experimental':
        return {
          label: 'Experimental',
          className: 'bg-amber-500/10 text-amber-300 border-amber-500/30'
        };
      case 'preview':
        return {
          label: 'Preview',
          className: 'bg-blue-500/10 text-blue-300 border-blue-500/30'
        };
      case 'unavailable':
      default:
        return {
          label: 'Unavailable',
          className: 'bg-white/5 text-slate-400 border-white/10'
        };
    }
  };

  const isLaunchable = (status: DesktopProfileStatus) => {
    return status === 'validated' || status === 'experimental';
  };

  const currentSelectedProfile = (isUbuntu ? DEBIAN_DESKTOP_PROFILES['ubuntu-kde'] : isArch ? DEBIAN_DESKTOP_PROFILES['arch-kde'] : isOpenSuse ? DEBIAN_DESKTOP_PROFILES['opensuse-tumbleweed-kde'] : isFedora ? DEBIAN_DESKTOP_PROFILES['fedora-kde'] : isAlpine ? DEBIAN_DESKTOP_PROFILES['alpine-kde'] : DEBIAN_DESKTOP_PROFILES[selectedDesktop]) || desktopList[0];
  const canLaunchCurrent = isLaunchable(currentSelectedProfile.status) || currentSelectedProfile.id === 'ubuntu-kde' || currentSelectedProfile.id === 'arch-kde' || currentSelectedProfile.id === 'opensuse-tumbleweed-kde' || currentSelectedProfile.id === 'fedora-kde' || currentSelectedProfile.id === 'alpine-kde';

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Monitor className="w-4 h-4" />
            <span>Step 2 of 2: {isUbuntu ? 'Ubuntu KDE Plasma 5.27' : 'Desktop Environment Selection'}</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {isUbuntu ? 'Ubuntu 24.04.5 LTS KDE Plasma' : 'Choose Graphical Environment'}
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            {isUbuntu
              ? 'WebLinux Local executes authentic Ubuntu 24.04.5 LTS Noble Numbat with KDE Plasma 5.27.12, Konsole, and Dolphin on RISC-V 64-bit NOMMU.'
              : 'Select the desktop shell to boot. WebLinux Local executes genuine compiled Linux desktop environments on top of Debian 13 Trixie (RISC-V 64-bit NOMMU).'}
          </p>
        </div>

        <button
          onClick={onLaunch}
          data-testid="launch-desktop-btn"
          disabled={!canLaunchCurrent}
          className={`mt-4 md:mt-0 flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white shadow-xl transition-all cursor-pointer self-start md:self-auto ${
            canLaunchCurrent
              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-purple-600/25 active:scale-95'
              : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-75'
          }`}
        >
          {canLaunchCurrent ? (
            <>
              <Zap className="w-4 h-4 fill-current" />
              <span>Launch {currentSelectedProfile.name}</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Launch Blocked: {currentSelectedProfile.name} (Missing NOMMU Packages)</span>
            </>
          )}
        </button>
      </div>

      {/* Cards Grid */}
      <div className={`grid grid-cols-1 ${desktopList.length === 1 ? 'max-w-2xl' : 'md:grid-cols-3'} gap-6`}>
        {desktopList.map((desktop) => {
          const isSelected = selectedDesktop === desktop.id;
          const isValidated = desktop.status === 'validated';
          const badge = getStatusBadge(desktop.status);

          return (
            <div
              key={desktop.id}
              data-testid={`card-${desktop.id}`}
              onClick={() => {
                onSelect(desktop.id);
              }}
              className={`rounded-2xl glass-panel p-6 border transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'border-purple-500 bg-purple-500/[0.06] shadow-xl shadow-purple-500/15 ring-2 ring-purple-500/30'
                  : 'border-white/10 hover:border-purple-500/50 hover:bg-white/[0.04]'
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
                    className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full border ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {desktop.description}
                </p>

                <div className="space-y-1.5 mb-4">
                  <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Features:</span>
                  <div className="space-y-1 text-xs text-slate-300">
                    {desktop.supportedFeatures.slice(0, 4).map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {!isValidated && desktop.id !== 'ubuntu-kde' ? (
                  <div className="mb-4 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 leading-tight">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Availability Blocker:</span>
                    </div>
                    <span>Precompiled {desktop.name} package set is unavailable on Debian 13 RISC-V NOMMU release disk image.</span>
                  </div>
                ) : desktop.knownLimitations.length > 0 && (
                  <div className="mb-4 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-300/90 leading-tight">
                    <span className="font-semibold text-amber-300">Note: </span>
                    {desktop.knownLimitations[0]}
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t border-white/5 text-xs">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Compositor:</span>
                  <span className="font-mono text-slate-300">{desktop.compositor}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Architecture:</span>
                  <span className="font-mono text-slate-300">RISC-V 64-bit NOMMU</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>RAM Requirement:</span>
                  <span className="font-semibold text-slate-300">{desktop.minimumRamMB} MiB (Min) / {desktop.recommendedRamMB} MiB (Rec)</span>
                </div>

                <button
                  type="button"
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {isSelected ? (isValidated ? 'Active Desktop Environment' : (desktop.id === 'ubuntu-kde' ? 'Selected (Experimental Desktop)' : 'Selected (Blocked on Image)')) : 'Select This Profile'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
