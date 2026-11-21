import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  ShieldCheck,
  Trash2,
  RefreshCw,
  Database,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { StorageUsageInfo } from '../../../../runtime/types';
import { OpfsManager } from '../../../../runtime/filesystem/OpfsManager';

export const StorageManagement: React.FC = () => {
  const [storageInfo, setStorageInfo] = useState<StorageUsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const opfs = OpfsManager.getInstance();

  const refreshStorage = async () => {
    setLoading(true);
    const info = await opfs.getStorageUsage();
    setStorageInfo(info);
    setLoading(false);
  };

  useEffect(() => {
    refreshStorage();
  }, []);

  const handleRequestPersistence = async () => {
    const granted = await opfs.requestPersistence();
    setActionMessage(
      granted
        ? 'Persistent storage granted! Browser will preserve Linux files even when disk space is tight.'
        : 'Persistent storage was not granted by the browser (using standard quota).'
    );
    await refreshStorage();
  };

  const handleResetDisk = async (name: string) => {
    if (confirm(`Are you sure you want to reset and wipe ${name}? All local files and changes will be permanently removed.`)) {
      await opfs.resetDisk(name);
      setActionMessage(`Disk ${name} has been reset.`);
      await refreshStorage();
    }
  };

  const handleResetAll = async () => {
    if (confirm('Are you sure you want to completely purge all WebLinux OPFS disks and start completely fresh?')) {
      await opfs.resetAll();
      setActionMessage('All browser-local Linux disks have been purged.');
      await refreshStorage();
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <HardDrive className="w-4 h-4" />
            <span>Origin Private File System Subsystem</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Local Storage & OPFS Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            WebLinux utilizes browser-local OPFS. Your files and system modifications remain 100% on your device and are never uploaded to any remote server.
          </p>
        </div>

        <button
          onClick={refreshStorage}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-slate-200 transition-all cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Storage
        </button>
      </div>

      {actionMessage && (
        <div className="p-4 mb-6 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-purple-400 hover:text-white font-bold ml-2">×</button>
        </div>
      )}

      {/* Main Quota Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Usage Meter */}
        <div className="md:col-span-2 glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span>Browser Storage Quota</span>
            </h3>
            <span className="text-xs font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              {storageInfo?.opfsSupported ? 'OPFS Supported' : 'OPFS Unavailable'}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Utilized: <strong className="text-white">{formatBytes(storageInfo?.usageBytes || 0)}</strong></span>
              <span>Total Available: <strong className="text-white">{formatBytes(storageInfo?.quotaBytes || 0)}</strong></span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-white/[0.05] rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1, Math.min(100, storageInfo?.usagePercentage || 0))}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400">
              {storageInfo?.usagePercentage ? storageInfo.usagePercentage.toFixed(2) : 0}% of allocated browser storage space is utilized.
            </p>
          </div>
        </div>

        {/* Persistence Status Card */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Durability Protection</span>
            </div>
            <h4 className="text-lg font-bold text-white mb-2">
              {storageInfo?.isPersistentGranted ? 'Guaranteed Persistent' : 'Best-Effort Cache'}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {storageInfo?.isPersistentGranted
                ? 'The browser guarantees disk contents will not be automatically purged under low memory.'
                : 'Storage may be evicted if the host computer runs critically low on free disk space.'}
            </p>
          </div>

          {!storageInfo?.isPersistentGranted && (
            <button
              onClick={handleRequestPersistence}
              className="mt-4 w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-md shadow-purple-600/20 active:scale-95"
            >
              Request Persistence
            </button>
          )}
        </div>
      </div>

      {/* Disks Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden mb-8">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Mounted OPFS Block Partitions</h3>
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge All Disks</span>
          </button>
        </div>

        <div className="divide-y divide-white/5">
          {storageInfo?.disks.map((disk) => (
            <div key={disk.name} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-purple-400">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white font-mono">{disk.name}</h4>
                  <p className="text-[11px] text-slate-400">
                    Type: <span className="capitalize text-slate-300">{disk.type} partition</span> • Format: <span className="text-slate-300">ext4 (1 MiB sparse chunks)</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-slate-300 font-semibold">{formatBytes(disk.bytes)}</span>
                <button
                  onClick={() => handleResetDisk(disk.name)}
                  className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title={`Reset ${disk.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
