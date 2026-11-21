import React, { useState } from 'react';
import { Download, Upload, Shield, CheckCircle2, AlertTriangle, FileArchive, RefreshCw } from 'lucide-react';
import { OpfsManager } from '../../../../runtime/filesystem/OpfsManager';
import { ImportResult } from '../../../../runtime/types';

export const BackupRestore: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const opfs = OpfsManager.getInstance();

  const handleExport = async () => {
    setIsExporting(true);
    setExportNotice(null);
    try {
      const blob = await opfs.exportHomeArchive();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weblinux-home-backup-${new Date().toISOString().slice(0, 10)}.wlbk`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportNotice('WebLinux user partition exported successfully to your local machine!');
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);
    try {
      const result = await opfs.importHomeArchive(file);
      setImportResult(result);
    } catch (err: any) {
      setImportResult({
        success: false,
        importedFilesCount: 0,
        totalBytes: 0,
        errors: [err.message],
      });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <FileArchive className="w-4 h-4" />
          <span>Disaster Recovery & Portability</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Backup & Restore Environment
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Export your entire home partition (`/root`) as an immutable backup file or restore an existing backup into your browser’s OPFS disk.
        </p>
      </div>

      {exportNotice && (
        <div className="p-4 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button onClick={() => setExportNotice(null)} className="text-emerald-400 hover:text-white font-bold ml-2">×</button>
        </div>
      )}

      {importResult && (
        <div className={`p-4 mb-6 rounded-xl border text-xs ${
          importResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {importResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">
              {importResult.success ? 'Archive Imported Successfully!' : 'Import Failed'}
            </span>
          </div>
          <p className="text-slate-300">
            {importResult.importedFilesCount} file(s) processed ({Math.round(importResult.totalBytes / 1024)} KB).
          </p>
          {importResult.errors && (
            <ul className="mt-2 list-disc list-inside text-rose-300">
              {importResult.errors.map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Export Card */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Export Local Archive</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Generates a standalone WebLinux snapshot (`.wlbk`) containing your personal files, shell history, and configured desktop settings from `/root`.
            </p>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-600/20 active:scale-95"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Export Backup Archive</span>
          </button>
        </div>

        {/* Import Card */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Restore Backup Archive</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Select a previously exported `.wlbk` file to restore your home directory and persist it in the Origin Private File System.
            </p>
          </div>

          <label className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95">
            {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>Select .wlbk Archive to Restore</span>
            <input
              type="file"
              accept=".wlbk,.json"
              onChange={handleFileChange}
              disabled={isImporting}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
