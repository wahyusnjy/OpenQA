
interface AIModelsViewProps {
  geminiModel: string;
  setGeminiModel: (model: any) => void;
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  saveSettings: (fields: Record<string, any>) => Promise<void>;
}

/**
 * Komponen Pengaturan Model AI (AIModelsView).
 * Tempat QA Engineer mengkonfigurasi model Gemini aktif yang bertugas menghasilkan ringkasan eksekusi yang gagal,
 * serta memodifikasi System Prompt panduan analisis kognitif kecerdasan buatan.
 */
export default function AIModelsView({
  geminiModel,
  setGeminiModel,
  systemPrompt,
  setSystemPrompt,
  saveSettings,
}: AIModelsViewProps) {
  return (
    <div className="h-full p-gutter flex flex-col gap-gutter overflow-hidden">
      <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest shrink-0">
        AI Models / Gemini Config
      </h3>
      
      <div className="flex-1 grid grid-cols-2 gap-gutter overflow-y-auto">
        
        {/* Kolom Kiri: Pilihan Model Gemini & System Prompt */}
        <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
          <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
            <span className="material-symbols-outlined text-primary">brain</span>
            <h4 className="font-bold text-sm text-on-surface">Gemini Brain Model Config</h4>
          </div>
          
          {/* Pilihan Model */}
          <div className="space-y-base">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Primary Model Selection</label>
            <select 
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-2 text-xs text-on-surface outline-none"
            >
              <option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended - Ultra-Fast Analysis)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Standard Model)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep reasoning & complex layout parsing)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro (Legacy Deep Reasoning)</option>
            </select>
          </div>

          {/* Kolom Pengisian System Prompt */}
          <div className="space-y-base">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Gemini System Prompt</label>
              <button 
                onClick={() => saveSettings({ gemini_model: geminiModel, system_prompt: systemPrompt })}
                className="text-primary text-[11px] font-bold hover:underline cursor-pointer"
              >
                Save AI Config
              </button>
            </div>
            <textarea 
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full h-[180px] bg-surface-container-lowest border border-outline-variant rounded-lg p-sm font-body-md text-xs text-on-surface focus:border-primary outline-none resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Kolom Kanan: Statistik Penggunaan Token API */}
        <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
          <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
            <span className="material-symbols-outlined text-primary">assessment</span>
            <h4 className="font-bold text-sm text-on-surface">API Usage & Token statistics</h4>
          </div>
          
          {/* Batas Harian */}
          <div className="space-y-sm">
            <div className="flex justify-between items-center text-xs text-on-surface-variant">
              <span>Daily API Request Count</span>
              <span className="font-bold text-on-surface">45 / 1,500 requests</span>
            </div>
            <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary w-[3%]" />
            </div>
          </div>

          {/* Grid Informasi Konsumsi */}
          <div className="grid grid-cols-2 gap-sm pt-sm">
            <div className="bg-surface-container-lowest p-sm rounded-lg border border-outline-variant/20">
              <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Total Tokens Consumed</div>
              <div className="text-lg font-bold text-on-surface mt-xs">125.8k</div>
            </div>
            <div className="bg-surface-container-lowest p-sm rounded-lg border border-outline-variant/20">
              <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Average response time</div>
              <div className="text-lg font-bold text-on-surface mt-xs">1.8s</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
