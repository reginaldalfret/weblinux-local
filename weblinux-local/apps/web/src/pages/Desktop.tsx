import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize2,
  Minimize2,
  Power,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Terminal,
  HardDrive,
  Cpu,
  Wifi,
  WifiOff,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Send,
  Loader2,
} from 'lucide-react';
import { DistributionManifest, DesktopEnvironmentId, RuntimeStatus } from '../../../../runtime/types';
import { WasmLinuxAdapter } from '../../../../runtime/adapters/WasmLinuxAdapter';

interface DesktopProps {
  manifest: DistributionManifest;
  desktop: DesktopEnvironmentId;
  runtimeStatus: RuntimeStatus;
  onShutdown: () => void;
  logs: string[];
}

export const Desktop: React.FC<DesktopProps> = ({
  manifest,
  desktop,
  runtimeStatus,
  onShutdown,
  logs,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalInput, setTerminalInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const adapter = WasmLinuxAdapter.getInstance();

  // Mount persistent Wayland rv-stage and display canvas into Desktop viewport
  useEffect(() => {
    const stage = document.getElementById('rv-stage');
    const bar = document.getElementById('rv-bar');
    const host = viewportRef.current;

    if (stage && host) {
      stage.style.position = 'relative';
      stage.style.left = '0';
      stage.style.top = '0';
      stage.style.width = '100%';
      stage.style.height = '100%';
      stage.style.opacity = '1';
      stage.style.pointerEvents = 'auto';
      stage.style.display = 'block';

      if (bar) {
        bar.style.position = 'relative';
        bar.style.opacity = '1';
        bar.style.pointerEvents = 'auto';
        host.appendChild(bar);
      }

      host.appendChild(stage);

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        const sc = document.getElementById('screen');
        if (sc) (sc as HTMLElement).focus({ preventScroll: true });
      }, 60);
    }

    return () => {
      const rvHost = document.getElementById('rv-host');
      if (stage && rvHost) {
        stage.style.position = 'fixed';
        stage.style.left = '-9999px';
        stage.style.top = '-9999px';
        stage.style.opacity = '0';
        stage.style.pointerEvents = 'none';
        rvHost.appendChild(stage);
      }
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.warn('Error attempting to enable fullscreen:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => {
        console.warn('Error attempting to exit fullscreen:', err);
      });
      setIsFullscreen(false);
    }
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim();
    setTerminalInput('');
    setCommandHistory(prev => [...prev, `$ ${cmd}`]);

    try {
      const res = await adapter.runCommand(cmd, 15000);
      if (res.stdout) {
        const outText = res.stdout;
        setCommandHistory(prev => [...prev, outText]);
      }
      if (res.exitCode !== 0 && res.exitCode !== null) {
        setCommandHistory(prev => [...prev, `[exit code: ${res.exitCode}]`]);
      }
    } catch (err: any) {
      // Fallback to raw tty input if marker polling times out
      adapter.sendInput(cmd + '\r');
    }
  };

  const handlePointerLock = () => {
    const sc = document.getElementById('screen') as HTMLCanvasElement;
    if (sc) {
      sc.requestPointerLock?.();
      sc.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col bg-[#050608] text-slate-100 ${
        isFullscreen ? 'h-screen w-screen' : 'h-full w-full'
      }`}
    >
      {/* Top OS Control Bar */}
      <div className="bg-[#0e111a] border-b border-white/10 px-4 py-2 flex items-center justify-between z-30 select-none">
        {/* Left: Distro & Desktop Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-xs tracking-tight text-white font-['JetBrains_Mono']">
              {manifest.name}
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
            {desktop}
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Uptime: {Math.floor(runtimeStatus.uptimeSeconds / 60)}m {runtimeStatus.uptimeSeconds % 60}s
          </span>
        </div>

        {/* Center: System Telemetry */}
        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>{runtimeStatus.allocatedMemoryMB} MiB RAM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>OPFS ext4: RW</span>
          </div>
          <div className="flex items-center gap-1.5">
            {runtimeStatus.networkConnected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{runtimeStatus.networkConnected ? 'Relay Active' : 'Offline'}</span>
          </div>
        </div>

        {/* Right: Quick OS Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Terminal Console Toggle */}
          <button
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              isTerminalOpen
                ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
            title="Toggle Kernel Terminal & Command Shell"
          >
            <Terminal className="w-4 h-4" />
            <span className="hidden sm:inline">Shell</span>
          </button>

          {/* Audio Toggle */}
          <button
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-xs transition-all cursor-pointer"
            title={isAudioEnabled ? 'Mute Sound' : 'Enable Sound'}
          >
            {isAudioEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-xs transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Shutdown Button */}
          <button
            onClick={onShutdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
            title="Shutdown and sync OPFS filesystem"
          >
            <Power className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Power Off</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div
        ref={viewportRef}
        onClick={handlePointerLock}
        className="relative flex-1 w-full h-full flex flex-col items-stretch justify-start bg-black overflow-hidden select-none cursor-crosshair"
      >
        {/* Overlay Helper Badge */}
        <div className="absolute top-4 left-4 z-20 pointer-events-none">
          <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Click inside canvas for pointer capture • Press Esc to release</span>
          </div>
        </div>

        {/* Initializing / Loading Overlay over canvas while Wayland or Plasma is spinning up */}
        {!runtimeStatus.waylandActive && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#07090e]/95 backdrop-blur-sm select-none">
            <div className="p-8 rounded-2xl bg-[#0f131d] border border-purple-500/30 shadow-2xl flex flex-col items-center max-w-md text-center">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-4" />
              <h3 className="text-base font-bold text-white mb-1">
                Starting {manifest.name} ({desktop})
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Launching genuine 64-bit Linux kernel, mounting OPFS ext4 rootfs, and initializing Wayland compositor...
              </p>
              <div className="flex items-center gap-4 text-xs font-mono text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20">
                <span>Uptime: {runtimeStatus.uptimeSeconds}s</span>
                <span>•</span>
                <span>RAM: {runtimeStatus.allocatedMemoryMB} MiB</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Bottom Terminal Drawer */}
      {isTerminalOpen && (
        <div className="h-64 bg-[#0a0c12] border-t border-purple-500/30 flex flex-col z-40 shadow-2xl animate-in slide-in-from-bottom duration-200">
          {/* Drawer Header */}
          <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2 text-xs font-mono text-purple-300">
              <Terminal className="w-3.5 h-3.5" />
              <span>Direct Linux TTY Console & Syslog</span>
            </div>
            <button
              onClick={() => setIsTerminalOpen(false)}
              className="text-slate-400 hover:text-white p-1 text-xs cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Console Output Log */}
          <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-slate-300 space-y-1">
            {logs.slice(-40).map((l, i) => (
              <div key={i} className="text-slate-400 leading-tight">
                {l}
              </div>
            ))}
            {commandHistory.map((cmd, i) => (
              <div key={`cmd-${i}`} className="text-emerald-300 font-semibold">
                {cmd}
              </div>
            ))}
          </div>

          {/* Interactive Command Input */}
          <form onSubmit={handleSendCommand} className="p-2 border-t border-white/10 flex items-center gap-2 bg-[#0d1017]">
            <span className="text-xs font-mono text-purple-400 pl-2">guest#</span>
            <input
              type="text"
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              placeholder="Execute command (e.g. uname -a, ls -la /debian, cat /etc/os-release)..."
              className="flex-1 bg-transparent border-0 text-xs font-mono text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <Send className="w-3 h-3" />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
