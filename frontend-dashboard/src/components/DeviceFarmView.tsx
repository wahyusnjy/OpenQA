
interface DeviceFarmViewProps {
  serial: string;
  setSerial: (val: string) => void;
}

/**
 * Komponen Device Farm (DeviceFarmView).
 * Ruang kontrol untuk manajemen perangkat HP fisik / Emulator.
 * Menampilkan daftar perangkat terhubung ADB, jendela mirroring web simulator, dan alat kontrol ADB utilitas.
 */
export default function DeviceFarmView({ serial, setSerial }: DeviceFarmViewProps) {
  return (
    <div className="h-full flex p-gutter gap-gutter overflow-hidden">
      
      {/* Pane Kiri: Daftar Perangkat Terhubung ADB */}
      <div className="w-[350px] flex flex-col gap-sm shrink-0 overflow-hidden">
        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">ADB Connected Devices</h3>
        <div className="space-y-sm overflow-y-auto flex-1">
          
          {/* Perangkat Aktif (Samsung A06) */}
          <div 
            onClick={() => setSerial('R9RY100N5CA')}
            className={`glass-panel p-md rounded-xl border-l-4 border-l-green-500 cursor-pointer hover:bg-surface-container-high transition-colors ${
              serial === 'R9RY100N5CA' ? 'bg-surface-container-high' : 'opacity-80'
            }`}
          >
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-on-surface">Samsung Galaxy A06 (SM-A065F)</h4>
              <span className="bg-green-500/10 text-green-400 text-[9px] px-2 py-0.5 rounded font-bold uppercase">Online</span>
            </div>
            <p className="text-xs font-code-sm text-on-surface-variant mt-sm">Serial: R9RY100N5CA</p>
            <div className="flex gap-md text-[11px] text-on-surface-variant mt-md">
              <span>OS: Android 16</span>
              <span>Battery: 84%</span>
            </div>
          </div>

          {/* Perangkat Offline (Google Pixel 6 Pro) */}
          <div className="glass-panel p-md rounded-xl border-l-4 border-l-outline opacity-65">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-on-surface">Google Pixel 6 Pro</h4>
              <span className="bg-outline-variant text-on-surface-variant text-[9px] px-2 py-0.5 rounded font-bold uppercase">Offline</span>
            </div>
            <p className="text-xs font-code-sm text-on-surface-variant mt-sm">Serial: Pixel6ProADB99</p>
            <div className="flex gap-md text-[11px] text-on-surface-variant mt-md">
              <span>OS: Android 13</span>
              <span>Battery: --</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pane Kanan: scrcpy Web Simulator & Utilitas Kontrol */}
      <div className="flex-1 flex gap-md overflow-hidden">
        
        {/* Jendela Mirroring Device */}
        <div className="flex-1 glass-panel p-md rounded-xl bg-surface-container-lowest flex flex-col overflow-hidden border border-outline-variant/30">
          <div className="flex justify-between items-center border-b border-outline-variant pb-xs shrink-0 mb-sm">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              scrcpy Web Mirroring ({serial})
            </h4>
            <span className="text-[10px] text-on-surface-variant font-mono">1080x2400 @ 30 FPS</span>
          </div>
          
          {/* Layar Visual Simulator */}
          <div className="flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center relative group">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7zRPKLz9iaKOT9JVnk7sykrmI1fryQVJinHglN7hbk0pch_GoK_we7b-m5bAryfSHnq8ZFmVI0zERACOwPE84ZLjAFHxOj8ChDtJbS2kecCa74_e0Xcew9Ggt9RdY590NgS_5CuyjIge3N8_OZqSsIWr_FbBXTwrNMCE9Wo_QMe5k6NYFzrewCn9QflnWjoJWyO_XSghUqaFuFe6X_mdkvkJYkZe2wsZ3WmdJFbwldd93_J8nRzkg5cFPJX_2j2whEcOz0W4uMg" 
              alt="Device Mirror" 
              className="h-full object-contain opacity-70 group-hover:scale-[1.01] transition-all"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
              <div className="text-center space-y-sm bg-black/60 backdrop-blur-md p-md rounded-xl border border-white/10">
                <span className="material-symbols-outlined text-[36px] text-primary">screen_share</span>
                <p className="text-xs font-bold text-white uppercase tracking-wider">Web-Mirroring Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* Panel Utilitas Kontrol Perangkat */}
        <div className="w-[280px] glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md shrink-0 border border-outline-variant/30">
          <h4 className="font-bold text-xs text-on-surface-variant uppercase tracking-wider">ADB Utility Tools</h4>
          <div className="space-y-sm">
            <button 
              onClick={() => alert(`Perintah ADB terkirim: adb -s ${serial} shell pm clear com.android.settings`)}
              className="w-full py-sm bg-surface-container-high hover:bg-surface-variant border border-outline-variant/30 rounded-lg text-xs font-bold flex items-center gap-xs justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">cleaning_services</span>
              Clear settings App Cache
            </button>
            
            <button 
              onClick={() => alert(`Perintah ADB terkirim: adb -s ${serial} reboot`)}
              className="w-full py-sm bg-surface-container-high hover:bg-surface-variant border border-outline-variant/30 rounded-lg text-xs font-bold flex items-center gap-xs justify-center text-error transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
              Reboot Device ({serial})
            </button>
            
            <button 
              onClick={() => alert(`Screenshot captured dari perangkat ${serial}! Tersimpan di folder outputs/screenshots.`)}
              className="w-full py-sm bg-surface-container-high hover:bg-surface-variant border border-outline-variant/30 rounded-lg text-xs font-bold flex items-center gap-xs justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">screenshot</span>
              Take ADB Screenshot
            </button>

            <button 
              onClick={() => alert(`Silakan unggah APK Anda untuk diinstal ke HP ${serial}.`)}
              className="w-full py-sm bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-lg text-xs font-bold flex items-center gap-xs justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">upload_file</span>
              Install APK massal
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
