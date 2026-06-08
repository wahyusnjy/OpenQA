import { useState, useEffect, useRef } from 'react';

interface Execution {
  id: number;
  test_case_id: number;
  status: 'PENDING' | 'PASSED' | 'FAILED';
  device_info: { model: string; os_version: string; adb_serial: string } | null;
  artifacts: { video_path?: string; ui_dump_path?: string; error_log_path?: string } | null;
  ai_summary: string | null;
  executed_at?: string;
}

interface TestSuite {
  id: number;
  title: string;
  platform: 'android' | 'web';
  driver: 'uiautomator2' | 'selenium';
  steps: Array<{
    step_number: number;
    action: string;
    target?: string;
    locator_type?: string;
    locator_value?: string;
    value?: string;
    description: string;
  }>;
}

// Helper untuk memformat inline styles (bold dan code) pada markdown
function formatInlineStyles(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-bold text-on-surface">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} className="bg-surface-container-highest px-1.5 py-0.5 rounded text-secondary font-code-sm text-xs">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// Custom Markdown Parser ringan untuk mengubah teks dari Gemini menjadi UI terstruktur
function parseMarkdown(text: string) {
  if (!text) return null;
  
  // Pisahkan berdasarkan baris kosong
  const blocks = text.split(/\n\n+/);
  
  return blocks.map((block, bIdx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Jika blok adalah Code Block (diawali dengan ```)
    if (trimmed.startsWith('```')) {
      const lines = trimmed.split('\n');
      const codeLines = lines.slice(1, lines.length - 1).join('\n');
      return (
        <div key={bIdx} className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/20 font-code-sm text-secondary-fixed text-xs overflow-x-auto my-2">
          <pre><code>{codeLines}</code></pre>
        </div>
      );
    }

    // Jika blok adalah Heading (dimulai dengan #)
    if (trimmed.startsWith('#')) {
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const content = trimmed.replace(/^#+\s*/, '');
      const formatted = formatInlineStyles(content);
      
      if (level === 1) return <h1 key={bIdx} className="text-xl font-bold text-on-surface mt-4 mb-2 border-b border-outline-variant/20 pb-1">{formatted}</h1>;
      if (level === 2) return <h2 key={bIdx} className="text-lg font-bold text-primary mt-3 mb-1.5">{formatted}</h2>;
      return <h3 key={bIdx} className="text-md font-semibold text-primary mt-2 mb-1">{formatted}</h3>;
    }

    // Jika blok adalah List Bullet (dimulai dengan -, *, atau angka)
    if (trimmed.startsWith('*') || trimmed.startsWith('-') || /^\d+\./.test(trimmed)) {
      const lines = trimmed.split('\n');
      return (
        <ul key={bIdx} className="list-disc pl-md space-y-1.5 my-2 text-on-surface-variant text-sm">
          {lines.map((line, lIdx) => {
            const content = line.replace(/^[-*\d.]+\s*/, '');
            return (
              <li key={lIdx} className="leading-relaxed">
                {formatInlineStyles(content)}
              </li>
            );
          })}
        </ul>
      );
    }

    // Paragraf biasa
    return (
      <p key={bIdx} className="leading-relaxed text-sm my-2 text-on-surface-variant text-justify">
        {formatInlineStyles(trimmed)}
      </p>
    );
  });
}

// Ekstrak code block pertama dari Gemini AI summary untuk auto-fix
function extractFirstCodeBlock(text: string) {
  const match = text.match(/```(?:python|javascript|code)?\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : null;
}

export default function App() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selectedExec, setSelectedExec] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(false);
  const [serial, setSerial] = useState('R9RY100N5CA'); // Default device serial
  const [activeTab, setActiveTab] = useState<'AI Analysis' | 'Logs' | 'Hierarchy XML'>('AI Analysis');
  
  // Menerapkan View State Baru
  const [currentView, setCurrentView] = useState<'Overview' | 'Test Suites' | 'Device Farm' | 'Web Drivers' | 'Cloud Analytics' | 'Clusters' | 'AI Models' | 'Settings'>('Overview');
  
  // Data log dan XML hasil load dinamis
  const [rawLogs, setRawLogs] = useState<string>('');
  const [uiHierarchy, setUiHierarchy] = useState<string>('');

  // Mock Data untuk Test Suites
  const [testSuites, setTestSuites] = useState<TestSuite[]>([
    {
      id: 1,
      title: 'Android Settings Flow (Regression)',
      platform: 'android',
      driver: 'uiautomator2',
      steps: [
        { step_number: 1, action: 'app_start', target: 'com.android.settings', description: 'Buka Settings' },
        { step_number: 2, action: 'wait', value: '2.0', description: 'Tunggu 2 detik' },
        { step_number: 3, action: 'click', locator_type: 'resource_id', locator_value: 'com.android.settings:id/tombol_fiktif', description: 'Klik tombol rahasia' }
      ]
    },
    {
      id: 2,
      title: 'User Login flow (Web App)',
      platform: 'web',
      driver: 'selenium',
      steps: [
        { step_number: 1, action: 'get_url', value: 'https://the-internet.herokuapp.com/login', description: 'Navigasi ke Login Page' },
        { step_number: 2, action: 'type', locator_type: 'id', locator_value: 'username', value: 'tomsmith', description: 'Input Username' },
        { step_number: 3, action: 'type', locator_type: 'id', locator_value: 'password', value: 'SuperSecretPassword!', description: 'Input Password' },
        { step_number: 4, action: 'click', locator_type: 'css', locator_value: 'button[type="submit"]', description: 'Klik Submit' }
      ]
    }
  ]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<number>(1);
  const selectedSuite = testSuites.find(s => s.id === selectedSuiteId) || testSuites[0];

  // States untuk Konfigurasi Web Drivers (Selenium)
  const [seleniumGridUrl, setSeleniumGridUrl] = useState('http://localhost:4444/wd/hub');
  const [targetBrowser, setTargetBrowser] = useState<'chrome' | 'firefox' | 'safari'>('chrome');
  const [screenResolution, setScreenResolution] = useState<'desktop' | 'mobile_web'>('desktop');
  const [sessionTimeout, setSessionTimeout] = useState(30);

  // States untuk Cloud Analytics / Archival History Filters
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PASSED' | 'FAILED'>('ALL');
  const [filterDevice, setFilterDevice] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // States untuk AI Models (Gemini Settings)
  const [geminiModel, setGeminiModel] = useState<'gemini-2.5-flash' | 'gemini-1.5-pro'>('gemini-2.5-flash');
  const [systemPrompt, setSystemPrompt] = useState(
    'Anda adalah asisten QA otomatis cerdas. Terjadi kesalahan saat menjalankan test case otomatis pada perangkat Android. Analisis log error dan XML, berikan penyebab serta proposed fix code.'
  );

  // States untuk Webhooks Settings
  const [webhookUrl, setWebhookUrl] = useState('https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX');
  const [enableSlackNotification, setEnableSlackNotification] = useState(true);

  // System Metrics & Status State
  const [systemMetrics, setSystemMetrics] = useState<{
    cpu_utilization: number;
    ram_utilization: number;
    postgres_status: string;
    redis_status: string;
    active_workers: Array<{ name: string; pid: number; listening: string; status: string }>;
  }>({
    cpu_utilization: 0,
    ram_utilization: 0,
    postgres_status: 'offline',
    redis_status: 'offline',
    active_workers: []
  });

  const selectedExecRef = useRef<Execution | null>(null);
  useEffect(() => {
    selectedExecRef.current = selectedExec;
  }, [selectedExec]);

  // Fetch settings dari backend
  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:3000/settings');
      const data = await res.json();
      if (data && data.gemini_model) {
        setGeminiModel(data.gemini_model);
      }
      if (data && data.system_prompt) {
        setSystemPrompt(data.system_prompt);
      }
      if (data && data.slack_webhook_url !== undefined) {
        setWebhookUrl(data.slack_webhook_url);
      }
      if (data && data.enable_slack !== undefined) {
        setEnableSlackNotification(data.enable_slack === 'true');
      }
    } catch (err) {
      console.error("Gagal memuat settings dari server:", err);
    }
  };

  // Save settings ke backend
  const saveSettings = async (updatedFields: Record<string, any>) => {
    try {
      const res = await fetch('http://localhost:3000/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        alert("Pengaturan berhasil disimpan ke database!");
        fetchSettings();
      } else {
        alert("Gagal menyimpan pengaturan: " + data.message);
      }
    } catch (err) {
      alert("Gagal menyimpan pengaturan ke server.");
    }
  };

  // Fetch system status metrics
  const fetchSystemMetrics = async () => {
    try {
      const res = await fetch('http://localhost:3000/system-status');
      const data = await res.json();
      if (data) {
        setSystemMetrics(data);
      }
    } catch (err) {
      console.error("Gagal mengambil system status:", err);
    }
  };

  // Fetch executions dari backend Rust Axum
  const fetchExecutions = async () => {
    try {
      const res = await fetch('http://localhost:3000/executions');
      const data = await res.json();
      if (Array.isArray(data)) {
        setExecutions(data);
        const currentSelected = selectedExecRef.current;
        if (currentSelected) {
          const updated = data.find(x => x.id === currentSelected.id);
          if (updated) setSelectedExec(updated);
        }
      }
    } catch (err) {
      console.error("Gagal mengambil data dari database backend:", err);
    }
  };

  useEffect(() => {
    fetchExecutions();
    fetchSettings();
    fetchSystemMetrics();
    
    const execInterval = setInterval(fetchExecutions, 5000);
    const metricsInterval = setInterval(fetchSystemMetrics, 4000);
    return () => {
      clearInterval(execInterval);
      clearInterval(metricsInterval);
    };
  }, []);

  // Reset log / xml dump ketika mengganti execution target
  useEffect(() => {
    setRawLogs('');
    setUiHierarchy('');
    setActiveTab('AI Analysis');
  }, [selectedExec?.id]);

  // Load static files (.log atau .xml) secara dinamis jika tabnya dibuka
  useEffect(() => {
    if (!selectedExec) return;

    if (activeTab === 'Logs' && selectedExec.artifacts?.error_log_path) {
      setRawLogs('Loading raw error logs from backend...');
      fetch(`http://localhost:3000/static/${selectedExec.artifacts.error_log_path}`)
        .then(res => res.text())
        .then(text => setRawLogs(text))
        .catch(err => setRawLogs(`Gagal memuat log error: ${err.message}`));
    }

    if (activeTab === 'Hierarchy XML' && selectedExec.artifacts?.ui_dump_path) {
      setUiHierarchy('Loading UI Hierarchy XML from backend...');
      fetch(`http://localhost:3000/static/${selectedExec.artifacts.ui_dump_path}`)
        .then(res => res.text())
        .then(text => setUiHierarchy(text))
        .catch(err => setUiHierarchy(`Gagal memuat XML dump: ${err.message}`));
    }
  }, [activeTab, selectedExec?.id]);

  // Trigger test case baru via Axum Orchestrator
  const triggerTest = async (testCaseId: number) => {
    setLoading(true);
    const suite = testSuites.find(s => s.id === testCaseId) || { platform: 'android' };
    const payloadBody = suite.platform === 'web' ? {} : { device_serial: serial };
    
    try {
      const res = await fetch(`http://localhost:3000/run-test/${testCaseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody)
      });
      const result = await res.json();
      if (result.status === 'SUCCESS') {
        alert(`Job ditambahkan ke Redis queue! Execution ID: #${result.execution_id}`);
        setCurrentView('Overview'); // Kembalikan ke Overview untuk melihat progress
        fetchExecutions();
      } else {
        alert(`Gagal trigger test: ${result.message}`);
      }
    } catch (err) {
      alert("Gagal memicu testing. Pastikan backend server aktif di http://localhost:3000");
    } finally {
      setLoading(false);
    }
  };

  // Format waktu relatif
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

  // Hitung Metrik Makro untuk Dashboard Overview
  const totalPassed = executions.filter(x => x.status === 'PASSED').length;
  const totalFailed = executions.filter(x => x.status === 'FAILED').length;
  const aiAnalyses = executions.filter(x => x.ai_summary && x.ai_summary.length > 50).length;
  const aiSuccessRate = totalFailed > 0 ? Math.round((aiAnalyses / totalFailed) * 100) : 100;
  const redisQueueSize = executions.filter(x => x.status === 'PENDING').length;

  // Ekstrak code fix dari Gemini jika ada
  const proposedCode = selectedExec?.ai_summary ? extractFirstCodeBlock(selectedExec.ai_summary) : null;

  // Filter executions untuk Cloud Analytics
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

  // Unique devices list untuk filter
  const deviceOptions = Array.from(new Set(executions.map(x => x.device_info?.model).filter(Boolean))) as string[];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-surface font-body-md select-none">
      
      {/* Sidebar Menu */}
      <aside className="flex flex-col h-screen shrink-0 w-[280px] bg-surface-container-low border-r border-outline-variant py-sm pt-xl">
        
        {/* Brand Logo */}
        <div className="px-md mb-xl flex items-center gap-xs">
          <span className="material-symbols-outlined text-primary font-bold text-headline-md" style={{ fontVariationSettings: "'FILL' 1" }}>
            developer_board
          </span>
          <div>
            <h1 className="font-display text-headline-md font-bold text-primary leading-tight">OpenQA</h1>
            <p className="font-label-caps text-[10px] text-on-surface-variant opacity-70 tracking-widest">QA ORCHESTRATOR v2.5</p>
          </div>
        </div>

        {/* Sidebar Mapped Items */}
        <nav className="flex-1 space-y-1">
          {[
            { id: 'Overview', label: 'Overview / Dashboard', icon: 'dashboard' },
            { id: 'Test Suites', label: 'Test Suites / Scenarios', icon: 'fact_check' },
            { id: 'Device Farm', label: 'Device Farm', icon: 'smartphone' },
            { id: 'Web Drivers', label: 'Web Drivers', icon: 'language' },
            { id: 'Cloud Analytics', label: 'Cloud Analytics', icon: 'analytics' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as any)}
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

        {/* Sidebar Footer */}
        <div className="px-md mt-auto pt-md space-y-2">
          <button 
            onClick={() => triggerTest(1)}
            disabled={loading}
            className="w-full bg-primary-container text-on-primary-container py-sm rounded-xl font-bold flex items-center justify-center gap-xs hover:opacity-90 transition-all active:scale-95 cursor-pointer disabled:opacity-55"
          >
            <span className="material-symbols-outlined">add_circle</span>
            New Test Run
          </button>
          <div className="border-t border-outline-variant pt-md mt-sm opacity-50">
            <a className="flex items-center gap-sm px-sm py-2 text-on-surface-variant text-label-caps hover:text-primary transition-colors" href="#">
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              Docs
            </a>
            <a className="flex items-center gap-sm px-sm py-2 text-on-surface-variant text-label-caps hover:text-primary transition-colors" href="#">
              <span className="material-symbols-outlined text-[18px]">contact_support</span>
              Support
            </a>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 h-screen flex flex-col overflow-hidden bg-surface">
        
        {/* Top Navigation Menu */}
        <header className="flex justify-between items-center w-full px-md py-sm border-b border-outline-variant bg-surface shrink-0">
          <div className="flex items-center gap-sm">
            <button 
              onClick={() => setCurrentView('Overview')}
              className="text-on-surface hover:text-primary font-bold text-headline-md transition-colors"
            >
              OpenQA
            </button>
          </div>
          <div className="flex items-center gap-md">
            <div className="flex items-center gap-lg mr-md">
              <button 
                onClick={() => setCurrentView('Overview')}
                className={`font-label-caps text-label-caps py-2 cursor-pointer transition-colors ${currentView === 'Overview' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setCurrentView('Clusters')}
                className={`font-label-caps text-label-caps py-2 cursor-pointer transition-colors ${currentView === 'Clusters' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}
              >
                Clusters / Workers
              </button>
              <button 
                onClick={() => setCurrentView('AI Models')}
                className={`font-label-caps text-label-caps py-2 cursor-pointer transition-colors ${currentView === 'AI Models' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}
              >
                AI Models
              </button>
              <button 
                onClick={() => setCurrentView('Settings')}
                className={`font-label-caps text-label-caps py-2 cursor-pointer transition-colors ${currentView === 'Settings' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}
              >
                Settings
              </button>
            </div>
            
            {/* Global Actions */}
            <div className="flex items-center gap-sm border-l border-outline-variant pl-md">
              <button 
                onClick={fetchExecutions}
                className="material-symbols-outlined p-xs rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
                title="Force refresh database"
              >
                refresh
              </button>
              <button className="material-symbols-outlined p-xs rounded-full hover:bg-surface-variant transition-colors relative cursor-pointer">
                notifications
                <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
              </button>
              <button className="material-symbols-outlined p-xs rounded-full bg-primary-container text-on-primary-container cursor-pointer">
                account_circle
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Views Workspace */}
        <div className="flex-1 overflow-hidden">
          
          {/* VIEW 1: OVERVIEW / DASHBOARD */}
          {currentView === 'Overview' && (
            <div className="h-full flex flex-col p-gutter gap-gutter overflow-hidden">
              
              {/* Macro Metrics Cards Row */}
              <div className="grid grid-cols-5 gap-sm shrink-0">
                <div className="glass-panel p-sm rounded-xl flex items-center gap-sm">
                  <div className="p-2 bg-green-500/10 text-green-400 rounded-lg">
                    <span className="material-symbols-outlined">check_circle</span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Passed Tests</div>
                    <div className="text-xl font-bold">{totalPassed}</div>
                  </div>
                </div>

                <div className="glass-panel p-sm rounded-xl flex items-center gap-sm">
                  <div className="p-2 bg-red-500/10 text-error rounded-lg">
                    <span className="material-symbols-outlined">cancel</span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Failed Tests</div>
                    <div className="text-xl font-bold">{totalFailed}</div>
                  </div>
                </div>

                <div className="glass-panel p-sm rounded-xl flex items-center gap-sm">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">AI Root Cause</div>
                    <div className="text-xl font-bold">{aiSuccessRate}%</div>
                  </div>
                </div>

                <div className="glass-panel p-sm rounded-xl flex items-center gap-sm">
                  <div className="p-2 bg-yellow-500/10 text-yellow-400 rounded-lg">
                    <span className="material-symbols-outlined">queue</span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Redis Queue</div>
                    <div className="text-xl font-bold">{redisQueueSize} <span className="text-[11px] font-normal text-on-surface-variant">pending</span></div>
                  </div>
                </div>

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

              {/* Main Workspace split: List (left) & Inspector (right) */}
              <div className="flex-1 flex gap-gutter min-h-0 overflow-hidden">
                
                {/* Left Column: Quick Trigger & Execution History */}
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
                        onClick={() => triggerTest(1)}
                        disabled={loading}
                        className="w-full bg-primary text-on-primary font-bold py-sm rounded-xl flex items-center justify-center gap-xs hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 font-bold"
                      >
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                          play_arrow
                        </span>
                        {loading ? 'Memproses...' : 'Run Android Test #1'}
                      </button>
                    </div>
                  </section>

                  {/* History List */}
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

                {/* Right Column: Main Inspection Split Screen */}
                <div className="flex-1 flex flex-col gap-md overflow-hidden">
                  {selectedExec ? (
                    <>
                      {/* Details Header */}
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
                            <p className="text-on-surface-variant text-body-md font-medium">Settings Flow - Test Case {selectedExec.test_case_id}</p>
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

                      {/* Video Player & Tab Viewer area */}
                      <div className="flex-1 flex gap-md overflow-hidden min-h-0">
                        {/* Left Video */}
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
                            ) : (
                              <div className="flex flex-col items-center justify-center text-on-surface-variant opacity-50">
                                <span className="material-symbols-outlined text-[64px] mb-2">videocam_off</span>
                                <p className="text-sm">Video recording not found or failed to process.</p>
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

                        {/* Right Tab Content */}
                        <div className="w-[450px] flex flex-col gap-md overflow-hidden shrink-0 border border-outline-variant/30 rounded-xl bg-surface-container-low p-sm">
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

                          <div className="flex-1 overflow-y-auto pr-1">
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
                                      <h3 className="font-headline-md text-on-surface text-[16px] font-bold">Gemini 2.5 Flash</h3>
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

                            {activeTab === 'Logs' && (
                              <div className="glass-panel rounded-xl p-md font-code-sm text-xs bg-surface-container-lowest border border-outline-variant/20 overflow-x-auto min-h-[250px] whitespace-pre-wrap break-all leading-normal">
                                {selectedExec.artifacts?.error_log_path ? (
                                  <code className="text-error">{rawLogs}</code>
                                ) : (
                                  <p className="text-on-surface-variant opacity-60 text-center py-8">Log error kosong atau eksekusi berhasil.</p>
                                )}
                              </div>
                            )}

                            {activeTab === 'Hierarchy XML' && (
                              <div className="glass-panel rounded-xl p-md font-code-sm text-xs bg-surface-container-lowest border border-outline-variant/20 overflow-x-auto min-h-[250px] whitespace-pre leading-normal">
                                {selectedExec.artifacts?.ui_dump_path ? (
                                  <code>{uiHierarchy}</code>
                                ) : (
                                  <p className="text-on-surface-variant opacity-60 text-center py-8">Hierarchy XML tidak tersedia.</p>
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
                      <p className="text-sm opacity-60 max-w-sm text-center px-6">Silakan pilih item dari daftar riwayat eksekusi di sebelah kiri untuk meninjau rekaman video, dump hierarki UI, dan analisis akar masalah dari Gemini AI.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: TEST SUITES / SCENARIOS */}
          {currentView === 'Test Suites' && (
            <div className="h-full flex p-gutter gap-gutter overflow-hidden">
              {/* Left Pane: Suites List */}
              <div className="w-[320px] flex flex-col gap-sm shrink-0">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">Test Suites</h3>
                <div className="space-y-sm overflow-y-auto flex-1">
                  {testSuites.map(suite => (
                    <div
                      key={suite.id}
                      onClick={() => setSelectedSuiteId(suite.id)}
                      className={`glass-panel p-md rounded-xl cursor-pointer hover:bg-surface-container-high transition-colors ${selectedSuiteId === suite.id ? 'border-l-4 border-l-primary bg-surface-container-high' : ''}`}
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
                  ))}
                </div>
              </div>

              {/* Right Pane: Steps Details & JSON Editor */}
              <div className="flex-1 flex flex-col gap-md overflow-hidden glass-panel p-md rounded-xl bg-surface-container-low">
                <div className="flex justify-between items-center border-b border-outline-variant pb-sm shrink-0">
                  <div>
                    <h3 className="font-headline-md text-on-surface text-lg">{selectedSuite.title}</h3>
                    <p className="text-xs text-on-surface-variant mt-xs">Platform: {selectedSuite.platform.toUpperCase()} • Driver: {selectedSuite.driver}</p>
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

                <div className="flex-1 grid grid-cols-2 gap-md min-h-0 overflow-hidden">
                  
                  {/* Left: Steps List */}
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

                  {/* Right: Steps JSON Editor */}
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
                          // Allow editing invalid JSON in textarea
                        }
                      }}
                      className="flex-1 w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-sm font-code-sm text-xs text-secondary-fixed focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: DEVICE FARM */}
          {currentView === 'Device Farm' && (
            <div className="h-full flex p-gutter gap-gutter overflow-hidden">
              {/* Left Pane: Device List */}
              <div className="w-[350px] flex flex-col gap-sm shrink-0 overflow-hidden">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">ADB Connected Devices</h3>
                <div className="space-y-sm overflow-y-auto flex-1">
                  
                  {/* Device 1 */}
                  <div className="glass-panel p-md rounded-xl border-l-4 border-l-green-500 bg-surface-container-high">
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

                  {/* Device 2 */}
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

              {/* Right Pane: scrcpy Live Mirroring Simulator & Control Utilities */}
              <div className="flex-1 flex gap-md overflow-hidden">
                
                {/* scrcpy Mirror Window */}
                <div className="flex-1 glass-panel p-md rounded-xl bg-surface-container-lowest flex flex-col overflow-hidden border border-outline-variant/30">
                  <div className="flex justify-between items-center border-b border-outline-variant pb-xs shrink-0 mb-sm">
                    <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-xs">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      scrcpy Web Mirroring (R9RY100N5CA)
                    </h4>
                    <span className="text-[10px] text-on-surface-variant font-mono">1080x2400 @ 30 FPS</span>
                  </div>
                  
                  {/* Simulated Mirror Screen Canvas */}
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

                {/* ADB Control Utilities Panel */}
                <div className="w-[280px] glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md shrink-0 border border-outline-variant/30">
                  <h4 className="font-bold text-xs text-on-surface-variant uppercase tracking-wider">ADB Utility Tools</h4>
                  <div className="space-y-sm">
                    <button 
                      onClick={() => alert("Perintah ADB terkirim: adb shell pm clear com.android.settings")}
                      className="w-full py-sm bg-surface-container-high hover:bg-surface-variant border border-outline-variant/30 rounded-lg text-xs font-bold flex items-center gap-xs justify-center transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">cleaning_services</span>
                      Clear settings App Cache
                    </button>
                    
                    <button 
                      onClick={() => alert("Perintah ADB terkirim: adb reboot")}
                      className="w-full py-sm bg-surface-container-high hover:bg-surface-variant border border-outline-variant/30 rounded-lg text-xs font-bold flex items-center gap-xs justify-center text-error transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">restart_alt</span>
                      Reboot Device (R9RY100N5CA)
                    </button>
                    
                    <button 
                      onClick={() => alert("Screenshot captured! Tersimpan di folder outputs/screenshots.")}
                      className="w-full py-sm bg-surface-container-high hover:bg-surface-variant border border-outline-variant/30 rounded-lg text-xs font-bold flex items-center gap-xs justify-center transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">screenshot</span>
                      Take ADB Screenshot
                    </button>

                    <button 
                      onClick={() => alert("Silakan unggah APK Anda untuk diinstal ke HP target.")}
                      className="w-full py-sm bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-lg text-xs font-bold flex items-center gap-xs justify-center transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">upload_file</span>
                      Install APK massal
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* VIEW 4: WEB DRIVERS */}
          {currentView === 'Web Drivers' && (
            <div className="h-full p-gutter flex flex-col gap-gutter overflow-hidden">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest shrink-0">Web Automation Drivers (Selenium)</h3>
              
              <div className="flex-1 grid grid-cols-3 gap-gutter overflow-y-auto">
                {/* Selenium Hub config */}
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

                {/* Target Browser config */}
                <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
                  <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
                    <span className="material-symbols-outlined text-primary">open_in_browser</span>
                    <h4 className="font-bold text-sm text-on-surface">Target Browser Config</h4>
                  </div>
                  <div className="space-y-sm">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Default Web Driver</label>
                    <div className="grid grid-cols-3 gap-xs">
                      {[
                        { id: 'chrome', label: 'Chrome' },
                        { id: 'firefox', label: 'Firefox' },
                        { id: 'safari', label: 'Safari' }
                      ].map(browser => (
                        <button
                          key={browser.id}
                          onClick={() => setTargetBrowser(browser.id as any)}
                          className={`py-sm rounded-lg text-xs font-bold cursor-pointer transition-colors ${targetBrowser === browser.id ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-variant'}`}
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

                {/* Resolution and parameters */}
                <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
                  <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
                    <span className="material-symbols-outlined text-primary">aspect_ratio</span>
                    <h4 className="font-bold text-sm text-on-surface">Screen & Timeout Parameters</h4>
                  </div>
                  <div className="space-y-sm">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Screen Layout</label>
                    <div className="grid grid-cols-2 gap-xs">
                      {[
                        { id: 'desktop', label: 'Desktop (1920x1080)' },
                        { id: 'mobile_web', label: 'Mobile Web (375x812)' }
                      ].map(res => (
                        <button
                          key={res.id}
                          onClick={() => setScreenResolution(res.id as any)}
                          className={`py-sm rounded-lg text-xs font-bold cursor-pointer transition-colors ${screenResolution === res.id ? 'bg-primary text-on-primary' : 'bg-surface-container hover:bg-surface-variant'}`}
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
          )}

          {/* VIEW 5: CLOUD ANALYTICS / HISTORY ARCHIVES */}
          {currentView === 'Cloud Analytics' && (
            <div className="h-full p-gutter flex flex-col gap-gutter overflow-hidden">
              
              {/* Header and Filter area */}
              <div className="flex flex-col gap-sm shrink-0 border-b border-outline-variant pb-md">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">Cloud Analytics / Historical Records</h3>
                
                {/* Search & Select Filter Row */}
                <div className="flex gap-md items-center">
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

              {/* Table list of archives */}
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
                          <td colSpan={6} className="text-center py-xl text-on-surface-variant opacity-60">Tidak ditemukan arsip pengetesan yang cocok.</td>
                        </tr>
                      ) : (
                        filteredExecutions.map(exec => (
                          <tr key={exec.id} className="hover:bg-surface-container-low/40">
                            <td className="py-sm px-md font-bold text-primary">#EXEC-{exec.id}</td>
                            <td className="py-sm px-md text-on-surface-variant">{formatTime(exec.executed_at)}</td>
                            <td className="py-sm px-md font-mono">{exec.device_info?.model || '--'}</td>
                            <td className="py-sm px-md">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter ${
                                exec.status === 'FAILED' ? 'bg-error-container text-on-error-container' : exec.status === 'PENDING' ? 'bg-primary-container text-on-primary-container' : 'bg-secondary-container text-on-secondary-container'
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
                                  setCurrentView('Overview');
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
          )}

          {/* VIEW 6: CLUSTERS / WORKERS */}
          {currentView === 'Clusters' && (
            <div className="h-full p-gutter flex flex-col gap-gutter overflow-hidden">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest shrink-0">Clusters / Worker Node Monitor</h3>
              
              <div className="flex-1 grid grid-cols-3 gap-gutter overflow-y-auto">
                {/* Hardware Resource Usage */}
                <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
                  <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
                    <span className="material-symbols-outlined text-primary">insights</span>
                    <h4 className="font-bold text-sm text-on-surface">Local Orchestrator Node</h4>
                  </div>
                  
                  {/* CPU Gauge */}
                  <div className="space-y-xs">
                    <div className="flex justify-between text-xs font-bold text-on-surface-variant">
                      <span>CPU Utilization (Macbook M-Series)</span>
                      <span className="text-primary font-bold">{Math.round(systemMetrics.cpu_utilization)}%</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${systemMetrics.cpu_utilization}%` }}></div>
                    </div>
                  </div>

                  {/* RAM Gauge */}
                  <div className="space-y-xs pt-sm">
                    <div className="flex justify-between text-xs font-bold text-on-surface-variant">
                      <span>RAM Utilization (unified memory)</span>
                      <span className="text-primary font-bold">{Math.round(systemMetrics.ram_utilization)}%</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${systemMetrics.ram_utilization}%` }}></div>
                    </div>
                  </div>
                  
                  <p className="text-[11px] text-on-surface-variant mt-sm leading-relaxed">Status node berjalan stabil. Menggunakan thread pools teroptimasi untuk orchestrator loop axum.</p>
                </div>

                {/* Queue status */}
                <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
                  <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
                    <span className="material-symbols-outlined text-primary">database</span>
                    <h4 className="font-bold text-sm text-on-surface">Queue & Database Status</h4>
                  </div>
                  
                  <div className="space-y-md">
                    <div className="flex justify-between items-center bg-surface-container-lowest p-sm border border-outline-variant/20 rounded-lg">
                      <div className="flex items-center gap-xs">
                        <span className={`w-2.5 h-2.5 rounded-full ${systemMetrics.postgres_status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-xs font-bold text-on-surface">PostgreSQL database</span>
                      </div>
                      <span className="text-[11px] text-on-surface-variant font-mono">5432/openQA</span>
                    </div>

                    <div className="flex justify-between items-center bg-surface-container-lowest p-sm border border-outline-variant/20 rounded-lg">
                      <div className="flex items-center gap-xs">
                        <span className={`w-2.5 h-2.5 rounded-full ${systemMetrics.redis_status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-xs font-bold text-on-surface">Redis Cache Server</span>
                      </div>
                      <span className="text-[11px] text-on-surface-variant font-mono">6379/db0</span>
                    </div>
                  </div>
                </div>

                {/* Active Python Worker processes */}
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
                            <div className="text-[10px] text-on-surface-variant font-mono mt-xs">PID: {worker.pid} • Listening: {worker.listening}</div>
                          </div>
                          <span className="bg-green-500/10 text-green-400 text-[9px] px-2 py-0.5 rounded font-bold uppercase">{worker.status}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* VIEW 7: AI MODELS */}
          {currentView === 'AI Models' && (
            <div className="h-full p-gutter flex flex-col gap-gutter overflow-hidden">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest shrink-0">AI Models / Gemini Config</h3>
              
              <div className="flex-1 grid grid-cols-2 gap-gutter overflow-y-auto">
                {/* Config Model */}
                <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
                  <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
                    <span className="material-symbols-outlined text-primary">brain</span>
                    <h4 className="font-bold text-sm text-on-surface">Gemini Brain Model Config</h4>
                  </div>
                  <div className="space-y-base">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Primary Model Selection</label>
                    <select 
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value as any)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-2 text-xs text-on-surface outline-none"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended - Ultra-Fast Analysis)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep reasoning & complex layout parsing)</option>
                    </select>
                  </div>

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

                {/* API limits and statistics */}
                <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
                  <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
                    <span className="material-symbols-outlined text-primary">assessment</span>
                    <h4 className="font-bold text-sm text-on-surface">API Usage & Token statistics</h4>
                  </div>
                  
                  <div className="space-y-sm">
                    <div className="flex justify-between items-center text-xs text-on-surface-variant">
                      <span>Daily API Request Count</span>
                      <span className="font-bold text-on-surface">45 / 1,500 requests</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-[3%]" />
                    </div>
                  </div>

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
          )}

          {/* VIEW 8: GLOBAL SETTINGS */}
          {currentView === 'Settings' && (
            <div className="h-full p-gutter flex flex-col gap-gutter overflow-hidden">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest shrink-0">Global Settings & Webhooks</h3>
              
              <div className="flex-1 grid grid-cols-2 gap-gutter overflow-y-auto">
                
                {/* Database Settings */}
                <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
                  <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
                    <span className="material-symbols-outlined text-primary">settings</span>
                    <h4 className="font-bold text-sm text-on-surface">QA Infrastructure Database Connection</h4>
                  </div>
                  <div className="space-y-base">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">PostgreSQL Database Connection String</label>
                    <input 
                      type="password" 
                      value="postgres://gugugaga:••••••••••••••••••••@localhost:5432/openQA"
                      disabled
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-2 text-xs text-on-surface-variant outline-none"
                    />
                  </div>
                  <div className="space-y-base">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Redis connection string</label>
                    <input 
                      type="text" 
                      value="redis://127.0.0.1:6379"
                      disabled
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-2 text-xs text-on-surface-variant outline-none"
                    />
                  </div>
                </div>

                {/* Slack & Reporting Integrations */}
                <div className="glass-panel p-md rounded-xl bg-surface-container-low flex flex-col gap-md border border-outline-variant/30">
                  <div className="flex items-center gap-xs border-b border-outline-variant pb-sm">
                    <span className="material-symbols-outlined text-primary">notifications_active</span>
                    <h4 className="font-bold text-sm text-on-surface">Reporting Webhook Integrations</h4>
                  </div>
                  
                  <div className="space-y-md">
                    <label className="flex items-center gap-xs text-xs text-on-surface cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={enableSlackNotification}
                        onChange={(e) => setEnableSlackNotification(e.target.checked)}
                        className="accent-primary"
                      />
                      Enable Instant Slack Notification on test failure
                    </label>

                    <div className="space-y-base">
                      <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Slack Incoming Webhook URL</label>
                      <input 
                        type="text" 
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-2 text-on-surface font-code-sm text-xs focus:border-primary outline-none"
                      />
                    </div>
                    
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
          )}

        </div>
      </main>

    </div>
  );
}