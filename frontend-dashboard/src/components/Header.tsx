import { type ViewName } from './Sidebar';

interface HeaderProps {
  currentView: ViewName;
  setCurrentView: (view: ViewName) => void;
  fetchExecutions: () => Promise<void>;
}

/**
 * Komponen Header utama di bagian atas halaman.
 * Menyediakan tombol menu cepat ke Dashboard, Clusters Node Monitor, AI Gemini Config, dan Settings,
 * serta tombol force-refresh database eksekusi.
 */
export default function Header({ currentView, setCurrentView, fetchExecutions }: HeaderProps) {
  // Rute tab yang ditampilkan di header atas sebelah kanan
  const headerTabs = [
    { id: 'Overview' as ViewName, label: 'Dashboard' },
    { id: 'Clusters' as ViewName, label: 'Clusters / Workers' },
    { id: 'AI Models' as ViewName, label: 'AI Models' },
    { id: 'Settings' as ViewName, label: 'Settings' }
  ];

  return (
    <header className="flex justify-between items-center w-full px-md py-sm border-b border-outline-variant bg-surface shrink-0">
      
      {/* Tombol Nama Brand Brand di Kiri */}
      <div className="flex items-center gap-sm">
        <button 
          onClick={() => setCurrentView('Overview')}
          className="text-on-surface hover:text-primary font-bold text-headline-md transition-colors"
        >
          OpenQA
        </button>
      </div>

      {/* Navigasi Menu Kanan & Global Actions */}
      <div className="flex items-center gap-md">
        
        {/* Navigasi Tab Header */}
        <div className="flex items-center gap-lg mr-md">
          {headerTabs.map((tab) => {
            const isActive = currentView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id)}
                className={`font-label-caps text-label-caps py-2 cursor-pointer transition-colors ${
                  isActive 
                    ? 'text-primary border-b-2 border-primary' 
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        
        {/* Indikator Status & Aksi Global */}
        <div className="flex items-center gap-sm border-l border-outline-variant pl-md">
          {/* Tombol refresh paksa data dari postgres database */}
          <button 
            onClick={fetchExecutions}
            className="material-symbols-outlined p-xs rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
            title="Force refresh database"
          >
            refresh
          </button>
          
          {/* Notifikasi Lonceng */}
          <button className="material-symbols-outlined p-xs rounded-full hover:bg-surface-variant transition-colors relative cursor-pointer">
            notifications
            <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
          </button>
          
          {/* Profil Akun */}
          <button className="material-symbols-outlined p-xs rounded-full bg-primary-container text-on-primary-container cursor-pointer">
            account_circle
          </button>
        </div>
      </div>
    </header>
  );
}
