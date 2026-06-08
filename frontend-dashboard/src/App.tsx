import { useState, useEffect, useRef } from 'react';
import Sidebar, { type ViewName } from './components/Sidebar';
import Header from './components/Header';
import OverviewView from './components/OverviewView';
import TestSuitesView from './components/TestSuitesView';
import DeviceFarmView from './components/DeviceFarmView';
import WebDriversView from './components/WebDriversView';
import CloudAnalyticsView from './components/CloudAnalyticsView';
import ClustersView from './components/ClustersView';
import AIModelsView from './components/AIModelsView';
import SettingsView from './components/SettingsView';
import DocsView from './components/DocsView';

// Struktur data eksekusi uji coba
export interface Execution {
  id: number;
  test_case_id: number;
  status: 'PENDING' | 'PASSED' | 'FAILED';
  device_info: { model: string; os_version: string; adb_serial: string } | null;
  artifacts: { video_path?: string; ui_dump_path?: string; error_log_path?: string; error_screenshot_path?: string } | null;
  ai_summary: string | null;
  executed_at?: string;
}

// Struktur data skenario pengujian
export interface TestSuite {
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

// Struktur data metrik infrastruktur cluster
export interface SystemMetrics {
  cpu_utilization: number;
  ram_utilization: number;
  postgres_status: string;
  redis_status: string;
  active_workers: Array<{ name: string; pid: number; listening: string; status: string }>;
}

/**
 * Komponen Utama Aplikasi (App).
 * Berperan sebagai State Orchestrator utama yang mengelola sinkronisasi database,
 * pemicu Redis queue run-test, pemantau polling metrik sistem, dan merender view secara dinamis.
 */
export default function App() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selectedExec, setSelectedExec] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(false);
  const [serial, setSerial] = useState('R9RY100N5CA'); // Serial perangkat Android target bawaan
  const [activeTab, setActiveTab] = useState<'AI Analysis' | 'Logs' | 'Hierarchy XML'>('AI Analysis');
  const [currentView, setCurrentView] = useState<ViewName>('Overview');
  
  // Penampung data log error & UI Hierarchy statis yang diambil dari Axum Server
  const [rawLogs, setRawLogs] = useState<string>('');
  const [uiHierarchy, setUiHierarchy] = useState<string>('');

  // Konfigurasi AI Model & Slack Webhooks (disinkronkan dengan database)
  const [geminiModel, setGeminiModel] = useState<string>('gemini-2.0-flash');
  const [systemPrompt, setSystemPrompt] = useState(
    'Anda adalah asisten QA otomatis cerdas. Terjadi kesalahan saat menjalankan test case otomatis pada perangkat Android. Analisis log error dan XML, berikan penyebab serta proposed fix code.'
  );
  const [webhookUrl, setWebhookUrl] = useState('https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX');
  const [enableSlackNotification, setEnableSlackNotification] = useState(true);

  // Metrik Status Server dan Database
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpu_utilization: 0,
    ram_utilization: 0,
    postgres_status: 'offline',
    redis_status: 'offline',
    active_workers: []
  });

  // Struktur Skenario Pengujian Statis (Mobile vs Web)
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

  // Mengamankan reference selectedExec agar polling interval tidak memicu loop rendering
  const selectedExecRef = useRef<Execution | null>(null);
  useEffect(() => {
    selectedExecRef.current = selectedExec;
  }, [selectedExec]);

  // Membaca pengaturan konfigurasi AI/Slack aktif dari server database
  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:3000/settings');
      const data = await res.json();
      if (data && data.gemini_model) setGeminiModel(data.gemini_model);
      if (data && data.system_prompt) setSystemPrompt(data.system_prompt);
      if (data && data.slack_webhook_url !== undefined) setWebhookUrl(data.slack_webhook_url);
      if (data && data.enable_slack !== undefined) setEnableSlackNotification(data.enable_slack === 'true');
    } catch (err) {
      console.error("Gagal memuat settings:", err);
    }
  };

  // Menyimpan pengaturan AI/Slack aktif ke server database
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

  // Memantau penggunaan CPU, RAM, koneksi DB, dan worker PID
  const fetchSystemMetrics = async () => {
    try {
      const res = await fetch('http://localhost:3000/system-status');
      const data = await res.json();
      if (data) setSystemMetrics(data);
    } catch (err) {
      console.error("Gagal mengambil system status:", err);
    }
  };

  // Mengambil daftar histori pengujian dari database Axum
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
      console.error("Gagal mengambil data executions:", err);
    }
  };

  // Inisialisasi polling berkala saat komponen pertama kali dipasang (mount)
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

  // Reset tab log ketika mengganti eksekusi uji yang diperiksa
  useEffect(() => {
    setRawLogs('');
    setUiHierarchy('');
    setActiveTab('AI Analysis');
  }, [selectedExec?.id]);

  // Mengambil isi teks berkas log dan hierarki XML static dari server web Axum
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

  // Memicu eksekusi skenario uji coba (Web/Android) ke server antrean
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
        alert(`Job berhasil ditambahkan! Execution ID: #${result.execution_id}`);
        setCurrentView('Overview');
        fetchExecutions();
      } else {
        alert(`Gagal trigger test: ${result.message}`);
      }
    } catch (err) {
      alert("Gagal memicu testing. Pastikan backend server aktif.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-surface font-body-md select-none">
      
      {/* Sidebar Navigasi Kiri */}
      <Sidebar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        triggerTest={triggerTest}
        loading={loading}
      />

      {/* Kontainer Utama */}
      <main className="flex-1 h-screen flex flex-col overflow-hidden bg-surface">
        
        {/* Header Atas */}
        <Header 
          currentView={currentView}
          setCurrentView={setCurrentView}
          fetchExecutions={fetchExecutions}
        />

        {/* Ruang Kerja Render Tampilan Dinamis */}
        <div className="flex-1 overflow-hidden">
          {currentView === 'Overview' && (
            <OverviewView 
              executions={executions}
              selectedExec={selectedExec}
              setSelectedExec={setSelectedExec}
              fetchExecutions={fetchExecutions}
              loading={loading}
              serial={serial}
              setSerial={setSerial}
              triggerTest={triggerTest}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              rawLogs={rawLogs}
              uiHierarchy={uiHierarchy}
            />
          )}

          {currentView === 'Test Suites' && (
            <TestSuitesView 
              testSuites={testSuites}
              setTestSuites={setTestSuites}
              selectedSuiteId={selectedSuiteId}
              setSelectedSuiteId={setSelectedSuiteId}
              triggerTest={triggerTest}
              loading={loading}
            />
          )}

          {currentView === 'Device Farm' && (
            <DeviceFarmView 
              serial={serial}
              setSerial={setSerial}
            />
          )}

          {currentView === 'Web Drivers' && (
            <WebDriversView />
          )}

          {currentView === 'Cloud Analytics' && (
            <CloudAnalyticsView 
              executions={executions}
              setSelectedExec={setSelectedExec}
              setCurrentView={setCurrentView}
            />
          )}

          {currentView === 'Clusters' && (
            <ClustersView 
              systemMetrics={systemMetrics}
            />
          )}

          {currentView === 'AI Models' && (
            <AIModelsView 
              geminiModel={geminiModel}
              setGeminiModel={setGeminiModel}
              systemPrompt={systemPrompt}
              setSystemPrompt={setSystemPrompt}
              saveSettings={saveSettings}
            />
          )}

          {currentView === 'Settings' && (
            <SettingsView 
              webhookUrl={webhookUrl}
              setWebhookUrl={setWebhookUrl}
              enableSlackNotification={enableSlackNotification}
              setEnableSlackNotification={setEnableSlackNotification}
              saveSettings={saveSettings}
            />
          )}

          {currentView === 'Docs' && (
            <DocsView />
          )}
        </div>
      </main>

    </div>
  );
}