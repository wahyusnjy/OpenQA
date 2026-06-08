/**
 * Komponen Panduan Dokumentasi (DocsView).
 * Menyajikan panduan lengkap penggunaan aplikasi OpenQA, setup infrastruktur, pengetesan
 * berbasis mobile (UIAutomator2) & browser (Selenium WebDriver), integrasi AI Gemini, serta referensi API.
 */
export default function DocsView() {
  return (
    <div className="h-full p-gutter flex flex-col gap-gutter overflow-hidden">
      
      {/* Header Halaman Docs */}
      <div className="flex flex-col gap-sm shrink-0 border-b border-outline-variant pb-md">
        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
          OpenQA Application Documentation
        </h3>
        <p className="text-xs text-on-surface-variant mt-xs">
          Panduan teknis orkestrasi pengujian otomatis menggunakan Rust Axum Core, Python Worker, dan AI Gemini.
        </p>
      </div>

      {/* Konten Scroll Dokumentasi */}
      <div className="flex-1 overflow-y-auto space-y-lg pr-md pb-xl">
        
        {/* Seksi 1: Pengenalan & Arsitektur */}
        <section className="glass-panel p-md rounded-xl space-y-sm">
          <h4 className="text-md font-bold text-primary flex items-center gap-xs">
            <span className="material-symbols-outlined">developer_board</span>
            1. Pengenalan & Arsitektur OpenQA
          </h4>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            OpenQA adalah platform <b>Hybrid QA Orchestrator</b> yang dirancang untuk menjalankan pengujian otomatis berskala besar.
            Sistem ini memisahkan tugas penjadwalan (*scheduling*) dengan tugas eksekusi (*test runner*) menggunakan antrean Redis:
          </p>
          <ul className="list-disc pl-md text-xs text-on-surface-variant space-y-base">
            <li><strong>Rust Axum Server</strong>: Bertindak sebagai API Gateway, memantau utilisasi hardware local, menyajikan file statis, dan menerima instruksi pemicu uji.</li>
            <li><strong>Redis Queue</strong>: Antrean asinkron <code>qa_automation_queue</code> tempat menyimpan pekerjaan yang siap dikonsumsi worker.</li>
            <li><strong>Python Worker Daemon</strong>: Standby mendengarkan antrean Redis, mengemudikan HP Android fisik via ADB atau mengendalikan headless Chrome browser via Selenium.</li>
            <li><strong>Google Gemini AI</strong>: Menerima dump hierarki UI XML/DOM HTML dan memberikan ringkasan penyebab serta kode perbaikan otomatis.</li>
          </ul>
        </section>

        {/* Seksi 2: Panduan Instalasi */}
        <section className="glass-panel p-md rounded-xl space-y-sm">
          <h4 className="text-md font-bold text-primary flex items-center gap-xs">
            <span className="material-symbols-outlined">terminal</span>
            2. Panduan Setup & Cara Menjalankan
          </h4>
          
          <div className="space-y-md">
            <div>
              <h5 className="text-xs font-bold text-on-surface">A. Database & Migrasi SQL</h5>
              <p className="text-[11px] text-on-surface-variant mb-base">Buat database di Postgres bernama <code>openQA</code> dan jalankan perintah DDL ini:</p>
              <pre className="bg-surface-container-lowest p-sm rounded text-[11px] font-code-sm text-purple-400 overflow-x-auto">
{`CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES
('gemini_model', 'gemini-2.0-flash'),
('system_prompt', 'Anda adalah asisten QA otomatis cerdas...');`}
              </pre>
            </div>

            <div>
              <h5 className="text-xs font-bold text-on-surface">B. Jalankan Backend (Rust)</h5>
              <pre className="bg-surface-container-lowest p-sm rounded text-[11px] font-code-sm text-purple-400">
cargo run
              </pre>
            </div>

            <div>
              <h5 className="text-xs font-bold text-on-surface">C. Jalankan Worker (Python)</h5>
              <pre className="bg-surface-container-lowest p-sm rounded text-[11px] font-code-sm text-purple-400">
source workers/.venv/bin/activate
python -u workers/worker.py
              </pre>
            </div>
          </div>
        </section>

        {/* Seksi 3: Android Automation Guide */}
        <section className="glass-panel p-md rounded-xl space-y-sm">
          <h4 className="text-md font-bold text-primary flex items-center gap-xs">
            <span className="material-symbols-outlined">smartphone</span>
            3. Panduan Pengujian Android
          </h4>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Pengujian otomatis perangkat mobile Android berjalan menggunakan driver **UIAutomator2** di Python.
            Setiap kali tes dijalankan:
          </p>
          <ol className="list-decimal pl-md text-xs text-on-surface-variant space-y-base">
            <li>Sistem memicu sub-proses perekaman layar native Android: <code>adb shell screenrecord /sdcard/automation_video.mp4</code>.</li>
            <li>Mengirimkan perintah klik/tulis teks berdasarkan locator `resource_id` atau `text`.</li>
            <li>Jika tes gagal, worker akan memicu <code>d.dump_hierarchy()</code> untuk mendownload struktur XML halaman aktif, mematikan proses rekaman, lalu menarik video ke lokal via <code>d.pull()</code>.</li>
          </ol>
        </section>

        {/* Seksi 4: Web Automation Guide */}
        <section className="glass-panel p-md rounded-xl space-y-sm">
          <h4 className="text-md font-bold text-primary flex items-center gap-xs">
            <span className="material-symbols-outlined">language</span>
            4. Panduan Pengujian Web (Selenium)
          </h4>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Pengujian web berjalan menggunakan driver **Selenium WebDriver** yang dipaketkan di virtualenv worker.
            Ketika platform `web` dipicu:
          </p>
          <ul className="list-disc pl-md text-xs text-on-surface-variant space-y-base">
            <li>Worker menginisialisasi ChromeDriver dalam **Headless Mode** dengan resolusi layar desktop 1920x1080.</li>
            <li>Langkah uji diproses berurutan, misal navigasi URL (`get_url`), pengisian form (`type`), dan klik tombol (`click`).</li>
            <li>Jika elemen tidak ditemukan, worker menyimpan source HTML halaman aktif sebagai dump log, dan mengambil tangkapan layar `error_screenshot.png` untuk ditampilkan di dashboard.</li>
          </ul>
        </section>

        {/* Seksi 5: AI Root Cause Analysis */}
        <section className="glass-panel p-md rounded-xl space-y-sm">
          <h4 className="text-md font-bold text-primary flex items-center gap-xs">
            <span className="material-symbols-outlined">psychology</span>
            5. Integrasi Gemini AI & Auto-Fix
          </h4>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Ketika eksekusi test berstatus **FAILED**, sistem secara asinkron mengirimkan log error serta potongan dump XML/HTML DOM ke Google Gemini API.
            Respons dari AI akan:
          </p>
          <ul className="list-disc pl-md text-xs text-on-surface-variant space-y-base">
            <li>Diterjemahkan secara visual ke tab **AI Analysis** menggunakan Markdown parser kustom.</li>
            <li>Menyediakan usulan perbaikan kode otomatis.</li>
            <li>Menampilkan tombol **Apply Auto-Fix** untuk langsung menambal bagian kode skrip pengujian yang salah.</li>
          </ul>
        </section>

        {/* Seksi 6: Referensi API HTTP */}
        <section className="glass-panel p-md rounded-xl space-y-sm">
          <h4 className="text-md font-bold text-primary flex items-center gap-xs">
            <span className="material-symbols-outlined">api</span>
            6. API Endpoints Reference
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-on-surface-variant">
              <thead>
                <tr className="border-b border-outline-variant font-bold bg-surface-container-low text-on-surface">
                  <th className="py-2 px-sm">Method</th>
                  <th className="py-2 px-sm">Endpoint</th>
                  <th className="py-2 px-sm">Fungsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                <tr>
                  <td className="py-2 px-sm text-green-400 font-bold">GET</td>
                  <td className="py-2 px-sm font-mono">/executions</td>
                  <td className="py-2 px-sm">Mengambil histori eksekusi tes dari Postgres.</td>
                </tr>
                <tr>
                  <td className="py-2 px-sm text-blue-400 font-bold">POST</td>
                  <td className="py-2 px-sm font-mono">/run-test/:id</td>
                  <td className="py-2 px-sm">Memasukkan pengujian otomatis berdasarkan ID skenario ke Redis Queue.</td>
                </tr>
                <tr>
                  <td className="py-2 px-sm text-green-400 font-bold">GET</td>
                  <td className="py-2 px-sm font-mono">/settings</td>
                  <td className="py-2 px-sm">Mengambil model AI & webhook Slack dari database.</td>
                </tr>
                <tr>
                  <td className="py-2 px-sm text-blue-400 font-bold">POST</td>
                  <td className="py-2 px-sm font-mono">/settings</td>
                  <td className="py-2 px-sm">Menyimpan atau memperbarui konfigurasi AI & webhook.</td>
                </tr>
                <tr>
                  <td className="py-2 px-sm text-green-400 font-bold">GET</td>
                  <td className="py-2 px-sm font-mono">/system-status</td>
                  <td className="py-2 px-sm">Mengambil utilitas CPU/RAM host, koneksi DB, dan PID worker yang aktif.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
