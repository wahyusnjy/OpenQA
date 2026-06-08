import { useState } from 'react';

/**
 * Komponen Konfigurasi Web Drivers (WebDriversView).
 * Digunakan untuk mengkonfigurasi Selenium Grid Hub, mendefinisikan target browser default
 * (Chrome, Firefox, Safari) dan mode pengujian (headless vs UI visual), resolusi layar, serta batas waktu sesi.
 */
export default function WebDriversView() {
  // States lokal yang didekapsulasi khusus untuk menu Web Drivers
  const [seleniumGridUrl, setSeleniumGridUrl] = useState('http://localhost:4444/wd/hub');
  const [targetBrowser, setTargetBrowser] = useState<'chrome' | 'firefox' | 'safari'>('chrome');
  const [screenResolution, setScreenResolution] = useState<'desktop' | 'mobile_web'>('desktop');
  const [sessionTimeout, setSessionTimeout] = useState(30);

  return (
    <div className="h-full p-gutter flex flex-col gap-gutter overflow-hidden">
      <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest shrink-0">
        Web Automation Drivers (Selenium)
      </h3>
      
      <div className="flex-1 grid grid-cols-3 gap-gutter overflow-y-auto">
        
        {/* Kolom 1: Konfigurasi Selenium Grid */}
        <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
          <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
            <span className="material-symbols-outlined text-primary">dns</span>
            <h4 className="font-bold text-sm text-on-surface">Selenium Grid Config</h4>
          </div>
          <div className="space-y-base">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Grid Hub URL</label>
            <input 
              type="text" 
              value={seleniumGridUrl}
              onChange={(e) => setSeleniumGridUrl(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-2 text-on-surface font-code-sm text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="space-y-base">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Concurrent Sessions Limit</label>
            <select className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-2 text-on-surface text-xs outline-none">
              <option>5 Concurrent Sessions</option>
              <option>10 Concurrent Sessions</option>
              <option>20 Concurrent Sessions</option>
            </select>
          </div>
          <div className="flex items-center gap-sm mt-md">
            <span className="w-3.5 h-3.5 rounded-full bg-green-500 shrink-0"></span>
            <span className="text-xs text-on-surface font-medium">Grid Connection: Online</span>
          </div>
        </div>

        {/* Kolom 2: Browser default & Mode Uji */}
        <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
          <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
            <span className="material-symbols-outlined text-primary">open_in_browser</span>
            <h4 className="font-bold text-sm text-on-surface">Target Browser Config</h4>
          </div>
          <div className="space-y-sm">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Default Web Driver</label>
            <div className="grid grid-cols-3 gap-xs">
              {[
                { id: 'chrome' as const, label: 'Chrome' },
                { id: 'firefox' as const, label: 'Firefox' },
                { id: 'safari' as const, label: 'Safari' }
              ].map(browser => (
                <button
                  key={browser.id}
                  onClick={() => setTargetBrowser(browser.id)}
                  className={`py-sm rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    targetBrowser === browser.id 
                      ? 'bg-primary text-on-primary' 
                      : 'bg-surface-container hover:bg-surface-variant'
                  }`}
                >
                  {browser.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-sm">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Browser Mode</label>
            <div className="flex gap-md">
              <label className="flex items-center gap-xs text-xs text-on-surface cursor-pointer">
                <input type="radio" name="headless" defaultChecked /> Headless Mode (CLI/Background)
              </label>
              <label className="flex items-center gap-xs text-xs text-on-surface cursor-pointer">
                <input type="radio" name="headless" /> UI Displayed Mode
              </label>
            </div>
          </div>
        </div>

        {/* Kolom 3: Parameter Resolusi Layar & Batas Waktu */}
        <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
          <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
            <span className="material-symbols-outlined text-primary">aspect_ratio</span>
            <h4 className="font-bold text-sm text-on-surface">Screen & Timeout Parameters</h4>
          </div>
          <div className="space-y-sm">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Screen Layout</label>
            <div className="grid grid-cols-2 gap-xs">
              {[
                { id: 'desktop' as const, label: 'Desktop (1920x1080)' },
                { id: 'mobile_web' as const, label: 'Mobile Web (375x812)' }
              ].map(res => (
                <button
                  key={res.id}
                  onClick={() => setScreenResolution(res.id)}
                  className={`py-sm rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    screenResolution === res.id 
                      ? 'bg-primary text-on-primary' 
                      : 'bg-surface-container hover:bg-surface-variant'
                  }`}
                >
                  {res.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-xs pt-sm">
            <div className="flex justify-between items-center text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              <span>Session Timeout</span>
              <span>{sessionTimeout} seconds</span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="120" 
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(parseInt(e.target.value))}
              className="w-full accent-primary bg-surface-container h-1.5 rounded-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
