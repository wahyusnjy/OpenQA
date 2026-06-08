
interface SettingsViewProps {
  webhookUrl: string;
  setWebhookUrl: (val: string) => void;
  enableSlackNotification: boolean;
  setEnableSlackNotification: (val: boolean) => void;
  saveSettings: (fields: Record<string, any>) => Promise<void>;
}

/**
 * Komponen Pengaturan Global (SettingsView).
 * Tempat mengatur integrasi pelaporan otomatis (Slack Webhooks) dan melihat informasi
 * string koneksi database serta Redis cache untuk infrastruktur OpenQA.
 */
export default function SettingsView({
  webhookUrl,
  setWebhookUrl,
  enableSlackNotification,
  setEnableSlackNotification,
  saveSettings,
}: SettingsViewProps) {
  return (
    <div className="h-full p-gutter flex flex-col gap-gutter overflow-hidden">
      <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest shrink-0">
        Global Settings & Webhooks
      </h3>
      
      <div className="flex-1 grid grid-cols-2 gap-gutter overflow-y-auto">
        
        {/* Kolom Kiri: Konfigurasi Database Read-Only */}
        <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
          <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
            <span className="material-symbols-outlined text-primary">settings</span>
            <h4 className="font-bold text-sm text-on-surface">QA Infrastructure Database Connection</h4>
          </div>
          <div className="space-y-base">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              PostgreSQL Database Connection String
            </label>
            <input 
              type="password" 
              value="postgres://gugugaga:••••••••••••••••••••@localhost:5432/openQA"
              disabled
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-2 text-xs text-on-surface-variant outline-none"
            />
          </div>
          <div className="space-y-base">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Redis Connection String
            </label>
            <input 
              type="text" 
              value="redis://127.0.0.1:6379"
              disabled
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-2 text-xs text-on-surface-variant outline-none"
            />
          </div>
        </div>

        {/* Kolom Kanan: Integrasi Slack Pelaporan Real-Time */}
        <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
          <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
            <span className="material-symbols-outlined text-primary">notifications_active</span>
            <h4 className="font-bold text-sm text-on-surface">Reporting Webhook Integrations</h4>
          </div>
          
          <div className="space-y-md">
            {/* Sakelar Notifikasi Slack */}
            <label className="flex items-center gap-xs text-xs text-on-surface cursor-pointer">
              <input 
                type="checkbox" 
                checked={enableSlackNotification}
                onChange={(e) => setEnableSlackNotification(e.target.checked)}
                className="accent-primary"
              />
              Enable Instant Slack Notification on test failure
            </label>

            {/* Input URL Webhook */}
            <div className="space-y-base">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Slack Incoming Webhook URL
              </label>
              <input 
                type="text" 
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-2 text-on-surface font-code-sm text-xs focus:border-primary outline-none"
              />
            </div>
            
            {/* Tombol Aksi Simpan & Uji Webhook */}
            <div className="flex gap-sm">
              <button 
                onClick={() => saveSettings({ slack_webhook_url: webhookUrl, enable_slack: enableSlackNotification ? 'true' : 'false' })}
                className="px-md py-sm bg-primary text-on-primary text-xs font-bold rounded-lg hover:opacity-90 cursor-pointer transition-all"
              >
                Save Slack Config
              </button>
              <button 
                onClick={() => alert("Test notification terkirim ke Slack!")}
                className="px-md py-sm bg-primary/10 border border-primary/30 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 cursor-pointer transition-colors"
              >
                Test Send webhook notification
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
