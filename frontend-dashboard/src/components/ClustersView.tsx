import { type SystemMetrics } from '../App';

interface ClustersViewProps {
  systemMetrics: SystemMetrics;
}

/**
 * Komponen Cluster & Worker Node Monitor (ClustersView).
 * Memberikan informasi real-time mengenai performa CPU & RAM komputer lokal (Orchestrator Node),
 * status kelangsungan server Redis & PostgreSQL database, serta mendaftar seluruh daemon python worker (`worker.py`) yang aktif.
 */
export default function ClustersView({ systemMetrics }: ClustersViewProps) {
  return (
    <div className="h-full p-gutter flex flex-col gap-gutter overflow-hidden">
      <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest shrink-0">
        Clusters / Worker Node Monitor
      </h3>
      
      <div className="flex-1 grid grid-cols-3 gap-gutter overflow-y-auto">
        
        {/* Kolom 1: Status Sumber Daya Hardware Lokal */}
        <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
          <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
            <span className="material-symbols-outlined text-primary">insights</span>
            <h4 className="font-bold text-sm text-on-surface">Local Orchestrator Node</h4>
          </div>
          
          {/* Gauge CPU */}
          <div className="space-y-xs">
            <div className="flex justify-between text-xs font-bold text-on-surface-variant">
              <span>CPU Utilization (Macbook M-Series)</span>
              <span className="text-primary font-bold">{Math.round(systemMetrics.cpu_utilization)}%</span>
            </div>
            <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500" 
                style={{ width: `${systemMetrics.cpu_utilization}%` }}
              ></div>
            </div>
          </div>

          {/* Gauge RAM */}
          <div className="space-y-xs pt-sm">
            <div className="flex justify-between text-xs font-bold text-on-surface-variant">
              <span>RAM Utilization (unified memory)</span>
              <span className="text-primary font-bold">{Math.round(systemMetrics.ram_utilization)}%</span>
            </div>
            <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500" 
                style={{ width: `${systemMetrics.ram_utilization}%` }}
              ></div>
            </div>
          </div>
          
          <p className="text-[11px] text-on-surface-variant mt-sm leading-relaxed">
            Status node berjalan stabil. Menggunakan thread pools teroptimasi untuk orchestrator loop axum.
          </p>
        </div>

        {/* Kolom 2: Status Antrean Redis & PostgreSQL Database */}
        <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
          <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
            <span className="material-symbols-outlined text-primary">database</span>
            <h4 className="font-bold text-sm text-on-surface">Queue & Database Status</h4>
          </div>
          
          <div className="space-y-md">
            {/* Koneksi PostgreSQL */}
            <div className="flex justify-between items-center bg-surface-container-lowest p-sm border border-outline-variant/20 rounded-lg">
              <div className="flex items-center gap-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${systemMetrics.postgres_status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-xs font-bold text-on-surface">PostgreSQL database</span>
              </div>
              <span className="text-[11px] text-on-surface-variant font-mono">5432/openQA</span>
            </div>

            {/* Koneksi Redis */}
            <div className="flex justify-between items-center bg-surface-container-lowest p-sm border border-outline-variant/20 rounded-lg">
              <div className="flex items-center gap-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${systemMetrics.redis_status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-xs font-bold text-on-surface">Redis Cache Server</span>
              </div>
              <span className="text-[11px] text-on-surface-variant font-mono">6379/db0</span>
            </div>
          </div>
        </div>

        {/* Kolom 3: Daemon Python Worker Aktif */}
        <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
          <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
            <span className="material-symbols-outlined text-primary">terminal</span>
            <h4 className="font-bold text-sm text-on-surface">Active Python Workers</h4>
          </div>
          <div className="space-y-sm">
            {systemMetrics.active_workers.length === 0 ? (
              <div className="text-[11px] text-on-surface-variant opacity-60">Tidak ada worker aktif yang terdeteksi.</div>
            ) : (
              systemMetrics.active_workers.map((worker, index) => (
                <div key={index} className="bg-surface-container-lowest p-sm border border-outline-variant/20 rounded-lg flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-on-surface">{worker.name}</div>
                    <div className="text-[10px] text-on-surface-variant font-mono mt-xs">
                      PID: {worker.pid} • Listening: {worker.listening}
                    </div>
                  </div>
                  <span className="bg-green-500/10 text-green-400 text-[9px] px-2 py-0.5 rounded font-bold uppercase">
                    {worker.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
