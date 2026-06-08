import { type TestSuite } from '../App';

interface TestSuitesViewProps {
  testSuites: TestSuite[];
  setTestSuites: (suites: TestSuite[]) => void;
  selectedSuiteId: number;
  setSelectedSuiteId: (id: number) => void;
  triggerTest: (id: number) => void;
  loading: boolean;
}

/**
 * Komponen Skenario Pengujian (TestSuitesView).
 * Memetakan daftar test case (mobile vs web), menampilkan langkah-langkah detail secara visual,
 * dan menyediakan editor JSON langsung untuk mengubah struktur langkah pengetesan (*step sequence*).
 */
export default function TestSuitesView({
  testSuites,
  setTestSuites,
  selectedSuiteId,
  setSelectedSuiteId,
  triggerTest,
  loading,
}: TestSuitesViewProps) {
  
  // Mencari objek skenario uji yang sedang aktif dipilih
  const selectedSuite = testSuites.find(s => s.id === selectedSuiteId) || testSuites[0];

  return (
    <div className="h-full flex p-gutter gap-gutter overflow-hidden">
      
      {/* Pane Kiri: Daftar Skenario Uji */}
      <div className="w-[320px] flex flex-col gap-sm shrink-0">
        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">Test Suites</h3>
        <div className="space-y-sm overflow-y-auto flex-1">
          {testSuites.map(suite => {
            const isSelected = selectedSuiteId === suite.id;
            return (
              <div
                key={suite.id}
                onClick={() => setSelectedSuiteId(suite.id)}
                className={`glass-panel p-md rounded-xl cursor-pointer hover:bg-surface-container-high transition-colors ${
                  isSelected ? 'border-l-4 border-l-primary bg-surface-container-high' : ''
                }`}
              >
                <h4 className="font-bold text-sm text-on-surface">{suite.title}</h4>
                <div className="flex items-center gap-xs text-[11px] text-on-surface-variant mt-sm">
                  <span className="material-symbols-outlined text-[14px]">
                    {suite.platform === 'android' ? 'smartphone' : 'language'}
                  </span>
                  <span>{suite.platform.toUpperCase()} ({suite.driver})</span>
                  <span className="mx-xs">•</span>
                  <span>{suite.steps.length} steps</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pane Kanan: Detail Langkah Uji & Editor JSON */}
      <div className="flex-1 flex flex-col gap-md overflow-hidden glass-panel p-md rounded-xl bg-surface-container-low">
        
        {/* Detail Header Skenario */}
        <div className="flex justify-between items-center border-b border-outline-variant pb-sm shrink-0">
          <div>
            <h3 className="font-headline-md text-on-surface text-lg">{selectedSuite.title}</h3>
            <p className="text-xs text-on-surface-variant mt-xs">
              Platform: {selectedSuite.platform.toUpperCase()} • Driver: {selectedSuite.driver}
            </p>
          </div>
          <button
            onClick={() => triggerTest(selectedSuite.id)}
            disabled={loading}
            className="bg-primary text-on-primary font-bold px-md py-sm rounded-lg text-xs flex items-center gap-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">play_arrow</span>
            Run Suite Scenario
          </button>
        </div>

        {/* Pembagi Tampilan Grid Kanan */}
        <div className="flex-1 grid grid-cols-2 gap-md min-h-0 overflow-hidden">
          
          {/* Kolom Kiri: Alur Langkah Secara Visual */}
          <div className="flex flex-col min-h-0 overflow-y-auto space-y-sm">
            <h4 className="font-bold text-xs text-on-surface-variant uppercase tracking-wider">Test Scenario Steps</h4>
            {selectedSuite.steps.map((step, idx) => (
              <div key={idx} className="bg-surface-container rounded-lg p-sm border border-outline-variant/20 flex gap-sm">
                <div className="h-6 w-6 rounded-full bg-primary-container text-on-primary-container text-xs font-bold flex items-center justify-center shrink-0">
                  {step.step_number}
                </div>
                <div className="space-y-xs">
                  <div className="text-xs font-bold text-on-surface">{step.description}</div>
                  <div className="font-code-sm text-[11px] text-purple-400">
                    Action: <span className="text-on-surface font-semibold">{step.action}</span>
                    {step.target && <> | Target: <span className="text-on-surface font-semibold">{step.target}</span></>}
                    {step.locator_value && <> | Locator: <span className="text-on-surface font-semibold">{step.locator_type}={step.locator_value}</span></>}
                    {step.value && <> | Value: <span className="text-on-surface font-semibold">{step.value}</span></>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Kolom Kanan: Editor JSON Steps Map */}
          <div className="flex flex-col min-h-0">
            <h4 className="font-bold text-xs text-on-surface-variant uppercase tracking-wider mb-sm">Edit Steps JSON Map</h4>
            <textarea
              value={JSON.stringify(selectedSuite.steps, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  const updated = testSuites.map(s => s.id === selectedSuite.id ? { ...s, steps: parsed } : s);
                  setTestSuites(updated);
                } catch(err) {
                  // Izinkan penulisan JSON sementara tidak valid di textarea saat diketik
                }
              }}
              className="flex-1 w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-sm font-code-sm text-xs text-secondary-fixed focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
