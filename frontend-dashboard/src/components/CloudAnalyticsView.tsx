import { useState } from 'react';
import { type Execution } from '../App';
import { type ViewName } from './Sidebar';

interface CloudAnalyticsViewProps {
  executions: Execution[];
  setSelectedExec: (exec: Execution | null) => void;
  setCurrentView: (view: ViewName) => void;
}

/**
 * Komponen Cloud Analytics / Riwayat Historis (CloudAnalyticsView).
 * Menyajikan basis data seluruh log uji coba dalam bentuk tabel terstruktur, lengkap dengan
 * penyaring (filter) status eksekusi (Lulus/Gagal), model perangkat Android/Browser, dan kolom pencarian kata kunci.
 */
export default function CloudAnalyticsView({
  executions,
  setSelectedExec,
  setCurrentView,
}: CloudAnalyticsViewProps) {
  // States penyaringan lokal yang didekapsulasi khusus untuk arsip riwayat
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PASSED' | 'FAILED'>('ALL');
  const [filterDevice, setFilterDevice] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Format Waktu Relatif
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return 'Active now';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} mins ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hours ago`;
      return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr || 'Just now';
    }
  };

  // Melakukan filter eksekusi berdasarkan kata kunci pencarian, status, dan jenis perangkat
  const filteredExecutions = executions.filter(exec => {
    if (filterStatus !== 'ALL' && exec.status !== filterStatus) return false;
    if (filterDevice !== 'ALL' && exec.device_info?.model !== filterDevice) return false;
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const matchId = exec.id.toString().includes(query);
      const matchModel = exec.device_info?.model.toLowerCase().includes(query) || false;
      const matchSummary = exec.ai_summary?.toLowerCase().includes(query) || false;
      return matchId || matchModel || matchSummary;
    }
    return true;
  });

  // Kumpulkan daftar nama perangkat unik secara dinamis untuk pilihan filter perangkat
  const deviceOptions = Array.from(
    new Set(executions.map(x => x.device_info?.model).filter(Boolean))
  ) as string[];

  return (
    <div className="h-full p-gutter flex flex-col gap-gutter overflow-hidden">
      
      {/* Kolom Filter & Pencarian */}
      <div className="flex flex-col gap-sm shrink-0 border-b border-outline-variant pb-md">
        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
          Cloud Analytics / Historical Records
        </h3>
        
        <div className="flex gap-md items-center">
          {/* Input Pencarian */}
          <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-1.5 flex items-center gap-xs">
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">search</span>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kata kunci error, ID eksekusi, atau model device..."
              className="w-full bg-transparent border-none outline-none text-xs text-on-surface"
            />
          </div>

          {/* Opsi Dropdown Filter */}
          <div className="flex gap-sm shrink-0">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-1.5 text-xs text-on-surface outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PASSED">Passed Only</option>
              <option value="FAILED">Failed Only</option>
            </select>

            <select 
              value={filterDevice}
              onChange={(e) => setFilterDevice(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-1.5 text-xs text-on-surface outline-none"
            >
              <option value="ALL">All Devices</option>
              {deviceOptions.map(dev => (
                <option key={dev} value={dev}>{dev}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabel Visualisasi Arsip Riwayat Eksekusi */}
      <div className="flex-1 overflow-hidden glass-panel rounded-xl flex flex-col bg-surface-container-lowest border border-outline-variant/30">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-low">
                <th className="py-sm px-md">Exec ID</th>
                <th className="py-sm px-md">Executed At</th>
                <th className="py-sm px-md">Device Model</th>
                <th className="py-sm px-md">Status</th>
                <th className="py-sm px-md">Failure Root Cause (Summary)</th>
                <th className="py-sm px-md">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 text-xs">
              {filteredExecutions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-xl text-on-surface-variant opacity-60">
                    Tidak ditemukan arsip pengetesan yang cocok.
                  </td>
                </tr>
              ) : (
                filteredExecutions.map(exec => (
                  <tr key={exec.id} className="hover:bg-surface-container-low/40">
                    <td className="py-sm px-md font-bold text-primary">#EXEC-{exec.id}</td>
                    <td className="py-sm px-md text-on-surface-variant">{formatTime(exec.executed_at)}</td>
                    <td className="py-sm px-md font-mono">{exec.device_info?.model || '--'}</td>
                    <td className="py-sm px-md">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter ${
                        exec.status === 'FAILED' 
                          ? 'bg-error-container text-on-error-container' 
                          : exec.status === 'PENDING' 
                          ? 'bg-primary-container text-on-primary-container' 
                          : 'bg-secondary-container text-on-secondary-container'
                      }`}>
                        {exec.status}
                      </span>
                    </td>
                    <td className="py-sm px-md max-w-[320px] truncate text-on-surface-variant">
                      {exec.ai_summary || (exec.status === 'PASSED' ? 'Test completed successfully.' : 'No AI Summary processed.')}
                    </td>
                    <td className="py-sm px-md">
                      <button
                        onClick={() => {
                          setSelectedExec(exec);
                          setCurrentView('Overview'); // Bawa pengguna kembali ke dashboard overview untuk melihat pemutar video & logs
                        }}
                        className="text-primary hover:underline font-bold text-[11px] cursor-pointer"
                      >
                        Inspect Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
