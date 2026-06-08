
// Tipe data view yang didukung oleh panel navigasi
export type ViewName = 'Overview' | 'Test Suites' | 'Device Farm' | 'Web Drivers' | 'Cloud Analytics' | 'Clusters' | 'AI Models' | 'Settings' | 'Docs';

interface SidebarProps {
  currentView: ViewName;
  setCurrentView: (view: ViewName) => void;
  triggerTest: (id: number) => void;
  loading: boolean;
}

/**
 * Komponen Sidebar navigasi sebelah kiri.
 * Menampilkan Logo, daftar menu alur kerja QA, tombol jalan uji coba cepat, dan tautan dokumentasi.
 */
export default function Sidebar({ currentView, setCurrentView, triggerTest, loading }: SidebarProps) {
  // Masing-masing menu memiliki ID rute, label, dan ikon material symbols
  const navigationItems = [
    { id: 'Overview' as ViewName, label: 'Overview / Dashboard', icon: 'dashboard' },
    { id: 'Test Suites' as ViewName, label: 'Test Suites / Scenarios', icon: 'fact_check' },
    { id: 'Device Farm' as ViewName, label: 'Device Farm', icon: 'smartphone' },
    { id: 'Web Drivers' as ViewName, label: 'Web Drivers', icon: 'language' },
    { id: 'Cloud Analytics' as ViewName, label: 'Cloud Analytics', icon: 'analytics' },
  ];

  return (
    <aside className="flex flex-col h-screen shrink-0 w-[280px] bg-surface-container-low border-r border-outline-variant py-sm pt-xl">
      
      {/* Brand Logo OpenQA */}
      <div className="px-md mb-xl flex items-center gap-xs">
        <span className="material-symbols-outlined text-primary font-bold text-headline-md" style={{ fontVariationSettings: "'FILL' 1" }}>
          developer_board
        </span>
        <div>
          <h1 className="font-display text-headline-md font-bold text-primary leading-tight">OpenQA</h1>
          <p className="font-label-caps text-[10px] text-on-surface-variant opacity-70 tracking-widest">QA ORCHESTRATOR v2.5</p>
        </div>
      </div>

      {/* Daftar Tautan Menu Kerja QA */}
      <nav className="flex-1 space-y-1">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`w-[calc(100%-16px)] flex items-center gap-sm px-md py-sm rounded-lg mx-2 transition-all duration-200 cursor-pointer ${
              currentView === item.id
                ? 'bg-secondary-container text-on-secondary-container font-semibold'
                : 'text-on-surface-variant hover:bg-surface-variant hover:translate-x-1'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: currentView === item.id ? "'FILL' 1" : undefined }}>
              {item.icon}
            </span>
            <span className="font-label-caps text-label-caps">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer Sidebar & Trigger Test Baru (Cepat) */}
      <div className="px-md mt-auto pt-md space-y-2">
        <button 
          onClick={() => triggerTest(1)} // Default memicu Test Case ID 1 (Android Settings Flow)
          disabled={loading}
          className="w-full bg-primary-container text-on-primary-container py-sm rounded-xl font-bold flex items-center justify-center gap-xs hover:opacity-90 transition-all active:scale-95 cursor-pointer disabled:opacity-55"
        >
          <span className="material-symbols-outlined">add_circle</span>
          New Test Run
        </button>
        <div className="border-t border-outline-variant pt-md mt-sm opacity-50">
          <button 
            onClick={() => setCurrentView('Docs')}
            className={`w-full flex items-center gap-sm px-sm py-2 text-label-caps hover:text-primary transition-colors cursor-pointer text-left ${
              currentView === 'Docs' ? 'text-primary font-bold' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
            Docs
          </button>
          <a className="flex items-center gap-sm px-sm py-2 text-on-surface-variant text-label-caps hover:text-primary transition-colors" href="#">
            <span className="material-symbols-outlined text-[18px]">contact_support</span>
            Support
          </a>
        </div>
      </div>
    </aside>
  );
}
