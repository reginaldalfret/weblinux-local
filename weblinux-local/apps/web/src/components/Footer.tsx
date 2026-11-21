import React from 'react';
import { Terminal, Shield, Scale, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/10 bg-[#07080c] py-12 px-4 lg:px-8 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        {/* Project info */}
        <div className="space-y-3 md:col-span-1">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-white tracking-tight text-sm font-['JetBrains_Mono']">
              WebLinux<span className="text-purple-400">.local</span>
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Genuine Linux desktops executing entirely client-side via WebAssembly, WebGL2/WebGPU, and OPFS block persistence.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-purple-300/80">
            <Scale className="w-3.5 h-3.5" />
            <span>GPL-2.0-or-later Compliant</span>
          </div>
        </div>

        {/* Upstream & Architecture */}
        <div className="space-y-2">
          <h4 className="font-semibold text-white uppercase tracking-wider text-[11px]">Runtime Foundation</h4>
          <ul className="space-y-1.5">
            <li><span className="text-slate-300">Kernel:</span> Linux wasm64_nommu (Joel Severin)</li>
            <li><span className="text-slate-300">JIT:</span> rv (RISC-V 64 to WebAssembly JIT)</li>
            <li><span className="text-slate-300">Compositor:</span> wlserver (Wayland on JavaScript)</li>
            <li><span className="text-slate-300">Desktops:</span> KDE Plasma 6 & IceWM</li>
            <li><span className="text-slate-300">Disks:</span> Origin Private File System (OPFS)</li>
          </ul>
        </div>

        {/* Source & Distribution Obligations */}
        <div className="space-y-2">
          <h4 className="font-semibold text-white uppercase tracking-wider text-[11px]">Source & Rights</h4>
          <ul className="space-y-1.5">
            <li>
              <a href="https://github.com/Pogo-Bash/rvwasm" target="_blank" rel="noreferrer" className="hover:text-purple-300 flex items-center gap-1">
                <span>rvwasm Upstream</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>
              <a href="https://kernel.org" target="_blank" rel="noreferrer" className="hover:text-purple-300 flex items-center gap-1">
                <span>Linux Kernel 6.x</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>
              <a href="https://plasmaontheweb.com" target="_blank" rel="noreferrer" className="hover:text-purple-300 flex items-center gap-1">
                <span>Plasma on the Web</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>
              <a href="https://debian.org" target="_blank" rel="noreferrer" className="hover:text-purple-300 flex items-center gap-1">
                <span>Debian riscv64 Archive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
          </ul>
        </div>

        {/* Trademark Notice */}
        <div className="space-y-2">
          <h4 className="font-semibold text-white uppercase tracking-wider text-[11px] flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Trademark Disclaimers</span>
          </h4>
          <p className="text-[11px] text-slate-400 leading-normal">
            WebLinux Local is an independent open-source project. Linux is a registered trademark of Linus Torvalds. Debian is a trademark of Software in the Public Interest. KDE and Plasma are registered trademarks of KDE e.V. Not affiliated with or endorsed by upstream projects.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
        <p>© 2026 WebLinux Local Project. Free and open source software under GNU General Public License v2+.</p>
        <div className="flex items-center gap-4">
          <span>Zero Server Compute</span>
          <span>•</span>
          <span>Zero User Tracking</span>
          <span>•</span>
          <span>100% Client-Side Execution</span>
        </div>
      </div>
    </footer>
  );
};
