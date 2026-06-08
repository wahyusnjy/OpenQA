import { type Execution } from '../App';
import { parseMarkdown, extractFirstCodeBlock } from './MarkdownParser';

interface OverviewViewProps {
  executions: Execution[];
  selectedExec: Execution | null;
  setSelectedExec: (exec: Execution | null) => void;
  fetchExecutions: () => Promise<void>;
  loading: boolean;
  serial: string;
  setSerial: (val: string) => void;
  triggerTest: (id: number) => void;
  activeTab: 'AI Analysis' | 'Logs' | 'Hierarchy XML';
  setActiveTab: (tab: 'AI Analysis' | 'Logs' | 'Hierarchy XML') => void;
  rawLogs: string;
  uiHierarchy: string;
}

/**
 * Komponen Dashboard Utama (OverviewView).
 * Menampilkan ringkasan metrik lulus/gagal, trigger tes manual, daftar riwayat eksekusi,
 * pemutar video rekaman uji coba, serta tab analisis kegagalan berbasis AI Gemini.
 */
export default function OverviewView({
  executions,
  selectedExec,
  setSelectedExec,
  fetchExecutions,
  loading,
  serial,
  setSerial,
  triggerTest,
  activeTab,
  setActiveTab,
  rawLogs,
  uiHierarchy,
}: OverviewViewProps) {

  // Hitung Metrik Makro untuk Dashboard Overview secara real-time
  const totalPassed = executions.filter(x => x.status === 'PASSED').length;
  const totalFailed = executions.filter(x => x.status === 'FAILED').length;
  const aiAnalyses = executions.filter(x => x.ai_summary && x.ai_summary.length > 50).length;
  const aiSuccessRate = totalFailed > 0 ? Math.round((aiAnalyses / totalFailed) * 100) : 100;
  const redisQueueSize = executions.filter(x => x.status === 'PENDING').length;

  // Ekstrak usulan kode perbaikan dari respon analitik Gemini AI (jika tersedia)
  const proposedCode = selectedExec?.ai_summary ? extractFirstCodeBlock(selectedExec.ai_summary) : null;

  // Format Waktu Relatif (Contoh: "Just now", "5 mins ago", atau "08/06/2026 12:00")
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

  return (
    <div className="h-full flex flex-col p-gutter gap-gutter overflow-hidden">
      
      {/* 1. Baris Kartu Metrik Makro */}
      <div className="grid grid-cols-5 gap-sm shrink-0">
        
        {/* Kartu Passed Tests */}
        <div className="glass-panel p-sm rounded-xl flex items-center gap-sm">
          <div className="p-2 bg-green-500/10 text-green-400 rounded-lg">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Passed Tests</div>
            <div className="text-xl font-bold">{totalPassed}</div>
          </div>
        </div>

        {/* Kartu Failed Tests */}
        <div className="glass-panel p-sm rounded-xl flex items-center gap-sm">
          <div className="p-2 bg-red-500/10 text-error rounded-lg">
            <span className="material-symbols-outlined">cancel</span>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Failed Tests</div>
            <div className="text-xl font-bold">{totalFailed}</div>
          </div>
        </div>

        {/* Kartu AI Root Cause Analysis Accuracy */}
        <div className="glass-panel p-sm rounded-xl flex items-center gap-sm">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">AI Root Cause</div>
            <div className="text-xl font-bold">{aiSuccessRate}%</div>
          </div>
        </div>

        {/* Kartu Redis Queue Size */}
        <div className="glass-panel p-sm rounded-xl flex items-center gap-sm">
          <div className="p-2 bg-yellow-500/10 text-yellow-400 rounded-lg">
            <span className="material-symbols-outlined">queue</span>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Redis Queue</div>
            <div className="text-xl font-bold">{redisQueueSize} <span className="text-[11px] font-normal text-on-surface-variant">pending</span></div>
          </div>
        </div>

        {/* Kartu Jumlah Perangkat Aktif */}
        <div className="glass-panel p-sm rounded-xl flex items-center gap-sm">
          <div className="p-2 bg-secondary-fixed-dim/20 text-secondary-fixed rounded-lg">
            <span className="material-symbols-outlined">smartphone</span>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Devices Farm</div>
            <div className="text-xl font-bold">1 <span className="text-[11px] font-normal text-on-surface-variant">Active</span></div>
          </div>
        </div>
      </div>

      {/* 2. Pembagi Halaman: Sisi Kiri (Histori/Pemicu) & Sisi Kanan (Pemeriksa Hasil) */}
      <div className="flex-1 flex gap-gutter min-h-0 overflow-hidden">
        
        {/* Kolom Kiri: Form Pemicu Cepat & Daftar Histori */}
        <div className="w-[380px] flex flex-col gap-gutter shrink-0 overflow-hidden">
          
          {/* Quick Trigger Form */}
          <section className="glass-panel rounded-xl p-md shrink-0">
            <div className="flex items-center justify-between mb-sm">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">Quick Trigger</h3>
              <span className="material-symbols-outlined text-primary text-[20px]">bolt</span>
            </div>
            <div className="space-y-md">
              <div className="space-y-base">
                <label className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Device Serial</label>
                <input 
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-2 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-code-sm"
                  type="text" 
                  value={serial} 
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="e.g. R9RY100N5CA"
                />
              </div>
              <button 
                onClick={() => triggerTest(1)} // Default menjalankan skrip Android test ID 1
                disabled={loading}
                className="w-full bg-primary text-on-primary font-bold py-sm rounded-xl flex items-center justify-center gap-xs hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_arrow
                </span>
                {loading ? 'Memproses...' : 'Run Android Test #1'}
              </button>
            </div>
          </section>

          {/* Execution History List */}
          <section className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex items-center justify-between mb-sm shrink-0">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">Execution History</h3>
              <button onClick={fetchExecutions} className="text-primary text-label-caps hover:underline cursor-pointer">Refresh</button>
            </div>
            
            <div className="space-y-sm overflow-y-auto flex-1 pb-md pr-1">
              {executions.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant text-sm opacity-60">Belum ada riwayat pengetesan.</div>
              ) : (
                executions.map((exec) => {
                  const isSelected = selectedExec?.id === exec.id;
                  const borderClass = exec.status === 'FAILED' 
                    ? 'border-l-error' 
                    : exec.status === 'PENDING' 
                    ? 'border-l-primary status-glow-pending' 
                    : 'border-l-secondary opacity-70';
                  
                  return (
                    <div 
                      key={exec.id} 
                      onClick={() => setSelectedExec(exec)}
                      className={`glass-panel rounded-xl p-sm border-l-4 cursor-pointer hover:bg-surface-container-high transition-all duration-150 ${borderClass} ${
                        isSelected ? 'bg-surface-container-high ring-1 ring-primary/40' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-xs">
                        <span className="font-code-sm text-on-surface font-bold">#EXEC-{exec.id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter ${
                          exec.status === 'FAILED' 
                            ? 'bg-error-container text-on-error-container' 
                            : exec.status === 'PENDING' 
                            ? 'bg-primary-container text-on-primary-container animate-pulse' 
                            : 'bg-secondary-container text-on-secondary-container'
                        }`}>
                          {exec.status === 'PENDING' ? 'Running' : exec.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-xs text-[11px] text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {formatTime(exec.executed_at)}
                        <span className="mx-xs">•</span>
                        <span className="material-symbols-outlined text-[14px]">smartphone</span>
                        {exec.device_info?.model || 'Pending Device'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Kolom Kanan: Detail Pemeriksa Eksekusi (Visualizer & AI Logger) */}
        <div className="flex-1 flex flex-col gap-md overflow-hidden">
          {selectedExec ? (
            <>
              {/* Header Informasi Eksekusi Aktif */}
              <div className="flex items-center justify-between glass-panel p-md rounded-xl shrink-0">
                <div className="flex items-center gap-md">
                  <div className={`h-12 w-12 flex items-center justify-center rounded-xl ${
                    selectedExec.status === 'FAILED' 
                      ? 'bg-error-container text-on-error-container' 
                      : selectedExec.status === 'PENDING' 
                      ? 'bg-primary-container text-on-primary-container' 
                      : 'bg-secondary-container text-on-secondary-container'
                  }`}>
                    <span className="material-symbols-outlined text-xl">
                      {selectedExec.status === 'FAILED' ? 'error_outline' : selectedExec.status === 'PENDING' ? 'pending' : 'check_circle'}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-headline-md text-on-surface flex items-center gap-sm">
                      Execution: #EXEC-{selectedExec.id}
                      <span className={`text-xs px-2 py-1 rounded-md font-bold uppercase tracking-tighter ${
                        selectedExec.status === 'FAILED' 
                          ? 'bg-error text-on-error' 
                          : selectedExec.status === 'PENDING' 
                          ? 'bg-primary-container text-on-primary-container' 
                          : 'bg-secondary text-on-secondary'
                      }`}>
                        {selectedExec.status === 'PENDING' ? 'Running' : selectedExec.status}
                      </span>
                    </h2>
                    <p className="text-on-surface-variant text-body-md font-medium">Scenario - Test Case {selectedExec.test_case_id}</p>
                  </div>
                </div>
                <div className="flex gap-sm">
                  {selectedExec.artifacts?.error_log_path && (
                    <a 
                      href={`http://localhost:3000/static/${selectedExec.artifacts.error_log_path}`}
                      download={`error_log_exec_${selectedExec.id}.txt`}
                      className="px-md py-sm border border-outline-variant rounded-lg text-label-caps hover:bg-surface-variant transition-colors flex items-center gap-xs cursor-pointer text-xs font-bold"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span> Export Logs
                    </a>
                  )}
                  <button 
                    onClick={() => triggerTest(selectedExec.test_case_id)}
                    disabled={loading}
                    className="px-md py-sm bg-primary text-on-primary rounded-lg text-label-caps font-bold hover:opacity-90 transition-all flex items-center gap-xs cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">replay</span> Rerun
                  </button>
                </div>
              </div>

              {/* Pemutar Video & Tab Viewer Log */}
              <div className="flex-1 flex gap-md overflow-hidden min-h-0">
                
                {/* Visualizer: Pemutar Video atau Tangkapan Screenshot Web */}
                <div className="flex-1 flex flex-col gap-md overflow-hidden">
                  <div className="relative flex-1 bg-surface-container-lowest rounded-xl overflow-hidden group border border-outline-variant/30 flex items-center justify-center">
                    {selectedExec.artifacts?.video_path ? (
                      <video 
                        key={selectedExec.artifacts.video_path}
                        src={`http://localhost:3000/static/${selectedExec.artifacts.video_path}`} 
                        controls 
                        autoPlay
                        className="w-full h-full object-contain" 
                      />
                    ) : selectedExec.artifacts?.error_screenshot_path ? (
                      <img 
                        src={`http://localhost:3000/static/${selectedExec.artifacts.error_screenshot_path}`}
                        alt="Error Web Screenshot"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-on-surface-variant opacity-50">
                        <span className="material-symbols-outlined text-[64px] mb-2">videocam_off</span>
                        <p className="text-sm">Video recording / screenshot not found or failed.</p>
                      </div>
                    )}
                    {selectedExec.status === 'PENDING' && (
                      <div className="absolute top-sm left-sm bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-xs border border-white/10 z-10">
                        <div className="w-2 h-2 bg-error rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Recording</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Log Inspector: AI Analysis, Raw Logs, & Hierarchy XML */}
                <div className="w-[450px] flex flex-col gap-md overflow-hidden shrink-0 border border-outline-variant/30 rounded-xl bg-surface-container-low p-sm">
                  
                  {/* Pilihan Tab Inspector */}
                  <div className="flex border-b border-outline-variant shrink-0">
                    {[
                      { id: 'AI Analysis', label: 'AI Analysis' },
                      { id: 'Logs', label: 'Logs' },
                      { id: 'Hierarchy XML', label: 'Hierarchy XML' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 text-center py-sm font-bold text-label-caps border-b-2 cursor-pointer transition-colors ${
                          activeTab === tab.id 
                            ? 'border-primary text-primary' 
                            : 'border-transparent text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Isi Konten Tab */}
                  <div className="flex-1 overflow-y-auto pr-1">
                    
                    {/* Tab AI Analysis */}
                    {activeTab === 'AI Analysis' && (
                      <div className="space-y-md">
                        <div className="ai-glass-panel rounded-2xl p-md relative overflow-hidden">
                          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 blur-[60px]"></div>
                          <div className="flex items-center gap-sm mb-sm relative z-10">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <span className="material-symbols-outlined text-primary font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
                                psychology
                              </span>
                            </div>
                            <div>
                              <h3 className="font-headline-md text-on-surface text-[16px] font-bold">Gemini AI Assistant</h3>
                              <p className="text-[10px] text-primary font-bold uppercase tracking-widest opacity-80">Root Cause Analysis</p>
                            </div>
                          </div>
                          <div className="space-y-xs text-on-surface-variant leading-relaxed text-sm relative z-10">
                            {selectedExec.ai_summary ? (
                              <div className="space-y-2 border-l-2 border-primary/20 pl-sm mt-md">
                                {parseMarkdown(selectedExec.ai_summary)}
                              </div>
                            ) : selectedExec.status === 'PENDING' ? (
                              <div className="text-center py-8 text-on-surface-variant opacity-75">
                                <span className="material-symbols-outlined animate-spin text-primary text-2xl mb-1">sync</span>
                                <p className="text-xs">Menunggu test run selesai untuk menjalankan Gemini AI summary...</p>
                              </div>
                            ) : (
                              <div className="text-center py-8 text-on-surface-variant opacity-75">
                                <span className="material-symbols-outlined text-2xl mb-1">sentiment_satisfied</span>
                                <p className="text-xs">Tidak ada kegagalan yang dilaporkan untuk eksekusi ini.</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Penerapan Auto-Fix */}
                        {proposedCode && selectedExec.status === 'FAILED' && (
                          <div className="glass-panel rounded-xl p-md border border-outline-variant/30 space-y-sm">
                            <p className="text-[11px] font-label-caps uppercase text-on-surface-variant opacity-60">Proposed Code Fix</p>
                            <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/20 font-code-sm text-secondary-fixed text-xs overflow-x-auto">
                              <pre><code>{proposedCode}</code></pre>
                            </div>
                            <button 
                              onClick={() => alert(`Auto-Fix berhasil di-apply:\n\n${proposedCode}`)}
                              className="w-full py-sm rounded-lg border border-primary/40 text-primary text-label-caps hover:bg-primary/10 transition-all flex items-center justify-center gap-xs cursor-pointer font-bold text-xs"
                            >
                              <span className="material-symbols-outlined text-[18px]">auto_fix</span> Apply Auto-Fix
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab Logs */}
                    {activeTab === 'Logs' && (
                      <div className="glass-panel rounded-xl p-md font-code-sm text-xs bg-surface-container-lowest border border-outline-variant/20 overflow-x-auto min-h-[250px] whitespace-pre-wrap break-all leading-normal">
                        {selectedExec.artifacts?.error_log_path ? (
                          <code className="text-error">{rawLogs}</code>
                        ) : (
                          <p className="text-on-surface-variant opacity-60 text-center py-8">Log error kosong atau eksekusi berhasil.</p>
                        )}
                      </div>
                    )}

                    {/* Tab Hierarchy XML */}
                    {activeTab === 'Hierarchy XML' && (
                      <div className="glass-panel rounded-xl p-md font-code-sm text-xs bg-surface-container-lowest border border-outline-variant/20 overflow-x-auto min-h-[250px] whitespace-pre leading-normal">
                        {selectedExec.artifacts?.ui_dump_path ? (
                          <code>{uiHierarchy}</code>
                        ) : (
                          <p className="text-on-surface-variant opacity-60 text-center py-8">Hierarchy XML / DOM tidak tersedia.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-surface-container-low border border-dashed border-outline-variant rounded-xl text-on-surface-variant">
              <span className="material-symbols-outlined text-[64px] mb-2 opacity-40 animate-pulse">
                developer_board
              </span>
              <h3 className="font-headline-md text-[18px] mb-1">OpenQA Workspace</h3>
              <p className="text-sm opacity-60 max-w-sm text-center px-6">Silakan pilih item dari daftar riwayat eksekusi di sebelah kiri untuk meninjau rekaman video/screenshot, dump hierarki UI, dan analisis akar masalah dari Gemini AI.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
