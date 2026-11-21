import React from 'react';
import { BookOpen, Shield, Cpu, HardDrive, Scale, ExternalLink, Terminal, Layers } from 'lucide-react';

export const Documentation: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <BookOpen className="w-4 h-4" />
          <span>Technical Reference</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          WebLinux Local Architecture & Compliance
        </h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
          Comprehensive documentation regarding the client-side WebAssembly kernel execution, licensing obligations under GNU GPL-2.0, storage persistence, and network isolation.
        </p>
      </div>

      <div className="space-y-10 text-slate-300 text-sm leading-relaxed">
        {/* Section 1: Executive Architecture */}
        <section className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" />
            <span>1. Real Client-Side Linux Execution</span>
          </h2>
          <p>
            Unlike web terminals or server-rendered cloud desktops (e.g. VNC, Guacamole, or WebRTC streaming), <strong>WebLinux Local executes genuine operating system binaries directly on the visitor’s device</strong>:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
            <li><strong>Linux Kernel:</strong> A genuine Linux kernel compiled to 64-bit WebAssembly (<code className="text-purple-300">wasm64_nommu</code>) based on Joel Severin’s <code className="text-purple-300">linux-wasm</code> project with custom patches for atomic synchronization, signal frames, and sound devices.</li>
            <li><strong>Multi-Worker Concurrency:</strong> Kernel tasks execute as individual Web Workers sharing a unified 4–16 GiB <code className="text-purple-300">SharedArrayBuffer</code> with zero-copy atomic synchronization.</li>
            <li><strong>RISC-V Userspace Translation:</strong> Unmodified Debian <code className="text-purple-300">riscv64</code> binaries execute via <code className="text-purple-300">rv</code>, a fast RISC-V user-mode JIT translator that compiles hot instructions into native WebAssembly modules on the fly.</li>
            <li><strong>Native WebAssembly Desktop Shell:</strong> The KDE Plasma 6 shell, Qt 6.8, and KDE Frameworks 6 run directly as native WebAssembly binaries, ensuring instant UI responsiveness without emulation penalties.</li>
          </ul>
        </section>

        {/* Section 2: Licensing and Legal Compliance */}
        <section className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-400" />
            <span>2. Open-Source Licensing Compliance & GPL-2.0</span>
          </h2>
          <p>
            WebLinux Local complies strictly with open-source licensing requirements:
          </p>
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 space-y-2">
            <p className="font-semibold">Corresponding Source Code Obligation:</p>
            <p>
              In accordance with Section 3 of the GNU General Public License (GPL-2.0), distributing compiled WebAssembly binaries and runtime scripts to client browsers constitutes software distribution. WebLinux Local makes the complete corresponding source code, build toolchain scripts, and kernel patches publicly available.
            </p>
          </div>
          <p>
            Trademark Separation: "rvwasm" and "plasmaontheweb.com" belong to Swap. "Linux" is a trademark of Linus Torvalds. "Debian" is a trademark of Software in the Public Interest. "KDE" and "Plasma" are registered trademarks of KDE e.V. WebLinux Local is an independent downstream product and is not affiliated with or endorsed by upstream owners.
          </p>
        </section>

        {/* Section 3: Storage and Local Persistence */}
        <section className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <span>3. Local Persistence via Origin Private File System (OPFS)</span>
          </h2>
          <p>
            Guest filesystems are divided into immutable 1 MiB chunked ext4 images:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
            <li><strong>On-Demand Chunk Fetching:</strong> Sectors are fetched on-demand the first time they are accessed, then persisted in the browser’s OPFS using synchronous access handles.</li>
            <li><strong>Isolated Home Disk:</strong> The user’s home partition (<code className="text-purple-300">/root</code>) is mounted as an independent writable virtual block device. It persists across visits and system restarts.</li>
            <li><strong>Zero Server Storage:</strong> Your personal files and terminal sessions exist solely inside your browser’s local storage.</li>
          </ul>
        </section>

        {/* Section 4: Network Isolation & Relay Security */}
        <section className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <span>4. Network Isolation & SSRF Protection</span>
          </h2>
          <p>
            To prevent abuse, botnet scanning, or Server-Side Request Forgery (SSRF):
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
            <li><strong>Offline-First:</strong> By default, WebLinux operates with all network sockets disconnected.</li>
            <li><strong>Restricted WebSocket Relay:</strong> When networking is enabled, traffic is tunneled through <code className="text-purple-300">rvRelay</code>.</li>
            <li><strong>Firewall & DNS Allowlisting:</strong> All private IP ranges (RFC 1918), loopback, link-local metadata addresses, and unauthorized destination ports are strictly rejected. Only allowlisted software package repositories (<code className="text-purple-300">deb.debian.org</code>, <code className="text-purple-300">pypi.org</code>, <code className="text-purple-300">npmjs.org</code>) are resolvable.</li>
          </ul>
        </section>

        {/* Section 5: Recommended Specifications */}
        <section className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <span>5. Recommended Hardware Specifications</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-white/10 rounded-xl overflow-hidden">
              <thead className="bg-white/[0.04] text-slate-200">
                <tr>
                  <th className="p-3">Resource</th>
                  <th className="p-3">Minimum Requirement</th>
                  <th className="p-3">Recommended Specification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="p-3 font-semibold text-white">CPU</td>
                  <td className="p-3">4 CPU cores</td>
                  <td className="p-3 text-purple-300 font-semibold">8+ CPU cores (Fast single-core performance)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">RAM</td>
                  <td className="p-3">8 GB Host RAM</td>
                  <td className="p-3 text-purple-300 font-semibold">16 GB Host RAM (tab allocates 4-8 GB)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">Browser</td>
                  <td className="p-3">Desktop Chrome 119+ / Edge / Brave</td>
                  <td className="p-3 text-purple-300 font-semibold">Latest Desktop Chrome or Edge (WebGL2 & OPFS)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">Disk Storage</td>
                  <td className="p-3">2 GB free browser storage</td>
                  <td className="p-3 text-purple-300 font-semibold">5+ GB free browser storage for ext4 cache</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
