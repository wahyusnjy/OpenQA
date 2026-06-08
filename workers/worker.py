import json
import time
import os
import subprocess
import redis
import uiautomator2 as u2
import psycopg2
from psycopg2.extras import Json
from dotenv import load_dotenv
# Kunci Utama: Import SDK baru dengan benar
from google import genai 

# Tentukan path workspace
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_ROOT = os.path.dirname(SCRIPT_DIR)

# Load environment variables dari .env di root workspace
# Ini sudah sangat benar untuk membaca file .env di luar folder workers
load_dotenv(os.path.join(WORKSPACE_ROOT, ".env"))

# Inisialisasi Redis dengan Keep-Alive
r = redis.Redis(
    host='localhost', 
    port=6379, 
    db=0, 
    socket_timeout=None,          
    health_check_interval=30      
)
queue_name = "qa_automation_queue"

# Detail Database Postgres (Tetap seperti kode kamu)
DB_URL = "postgresql://gugugaga:yangadabadaknya@localhost:5432/openQA"

def update_execution(execution_id, status, device_info=None, artifacts=None, ai_summary=None):
    """
    Memperbarui baris test_executions di PostgreSQL.
    """
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        updates = ["status = %s"]
        params = [status]
        
        if device_info is not None:
            updates.append("device_info = %s")
            params.append(Json(device_info))
            
        if artifacts is not None:
            updates.append("artifacts = %s")
            params.append(Json(artifacts))
            
        if ai_summary is not None:
            updates.append("ai_summary = %s")
            params.append(ai_summary)
            
        params.append(execution_id)
        query = f"UPDATE test_executions SET {', '.join(updates)} WHERE id = %s"
        
        cur.execute(query, params)
        conn.commit()
        cur.close()
        conn.close()
        print(f"💾 [Postgres] Berhasil update status Execution ID {execution_id} menjadi {status}")
    except Exception as db_err:
        print(f"❌ [Postgres] Gagal memperbarui tabel test_executions: {db_err}")

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    pass

def get_ai_settings():
    """
    Mengambil model Gemini dan system prompt dari database settings.
    """
    model_name = "gemini-2.5-flash"
    system_prompt = "Anda adalah asisten QA otomatis cerdas. Terjadi kesalahan saat menjalankan test case otomatis pada perangkat Android. Analisis log error dan XML, berikan penyebab serta proposed fix code."
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        cur.execute("SELECT key, value FROM settings WHERE key IN ('gemini_model', 'system_prompt')")
        rows = cur.fetchall()
        for row in rows:
            if row[0] == 'gemini_model' and row[1]:
                model_name = row[1]
            elif row[0] == 'system_prompt' and row[1]:
                system_prompt = row[1]
        cur.close()
        conn.close()
    except Exception as e:
        print(f"⚠️ Gagal mengambil AI settings dari database: {e}")
    return model_name, system_prompt

def get_by_locator(locator_type, locator_value):
    lt = locator_type.lower() if locator_type else ""
    if lt == "id":
        return By.ID, locator_value
    elif lt in ("css", "css_selector"):
        return By.CSS_SELECTOR, locator_value
    elif lt == "xpath":
        return By.XPATH, locator_value
    elif lt == "name":
        return By.NAME, locator_value
    elif lt in ("class", "class_name"):
        return By.CLASS_NAME, locator_value
    else:
        if locator_value.startswith("/") or locator_value.startswith("("):
            return By.XPATH, locator_value
        return By.CSS_SELECTOR, locator_value

def generate_ai_summary(error_msg, xml_dump, failed_step, platform="android"):
    """
    Memanggil Gemini API untuk menganalisis error dan dump XML / DOM HTML.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("⚠️ GEMINI_API_KEY tidak dikonfigurasi di environment atau .env")
        return "Gagal mendapatkan AI Summary karena GEMINI_API_KEY tidak dikonfigurasi."
        
    model_name, system_prompt = get_ai_settings()
    print(f"🤖 Menggunakan model: {model_name}")
        
    try:
        ai_client = genai.Client()
        
        prompt = f"""
{system_prompt}

Detail Kesalahan:
- Platform: {platform}
- Langkah Gagal: {failed_step}
- Pesan Error: {error_msg}
"""
        if platform == "android":
            prompt += f"""
Berikut adalah potongan dump UI Hierarchy XML dari layar terakhir ketika error terjadi:
```xml
{xml_dump}
```
"""
        else:
            prompt += f"""
Berikut adalah cuplikan DOM HTML dari halaman web saat error terjadi:
```html
{xml_dump[:30000]}
```
"""

        response = ai_client.models.generate_content(
            model=model_name,
            contents=prompt
        )
        return response.text
    except Exception as ai_err:
        print(f"❌ [AI] Gagal memanggil Gemini API: {ai_err}")
        return f"Gagal menghasilkan ringkasan otomatis karena error pada AI Integration: {str(ai_err)}"

print("🚀 Python Worker siap menerima job dan standby berhari-hari...")

while True:
    try:
        # Ambil data dari antrean (Tunggu maks 10 detik per siklus)
        result = r.brpop(queue_name, timeout=10)
        
        if result is None:
            continue 
            
        _, message = result
        payload = json.loads(message.decode('utf-8'))
        
        execution_id = payload["execution_id"]
        serial = payload["device_serial"]
        steps = payload["steps"]
        platform = payload.get("platform", "android")
        
        print(f"\n📦 Menjalankan Execution ID: {execution_id} pada platform {platform} (device: {serial})")
        
        # Setup direktori output lokal untuk artifacts
        output_dir = os.path.join(WORKSPACE_ROOT, "outputs", "executions", str(execution_id))
        os.makedirs(output_dir, exist_ok=True)
        
        video_path_phone = "/sdcard/automation_video.mp4"
        video_path_local = os.path.join(output_dir, "video.mp4")
        ui_dump_local = os.path.join(output_dir, "ui_dump.xml")
        error_log_local = os.path.join(output_dir, "error.log")
        error_screenshot_local = os.path.join(output_dir, "error_screenshot.png")
        
        d = None
        driver = None
        execution_status = "PASSED"
        error_message = None
        failed_step_desc = None
        xml_dump_content = None
        device_info = {}
        recording_process = None
        
        try:
            if platform == "android":
                # Konek ke device Android
                d = u2.connect(serial)
                
                # Ambil device info
                try:
                    dev_info_raw = d.device_info
                    device_info = {
                        "model": dev_info_raw.get("model", "Unknown Device"),
                        "os_version": f"Android {dev_info_raw.get('version', '')}",
                        "adb_serial": serial
                    }
                except Exception:
                    device_info = {
                        "model": "Unknown Device",
                        "os_version": "Unknown",
                        "adb_serial": serial
                    }
                
                # Bersihkan Logcat lama via u2
                try:
                    d.shell(["logcat", "-c"])
                except Exception:
                    pass
                    
                # Mulai perekaman layar via native Android screenrecord di background
                try:
                    d.shell(["rm", video_path_phone])
                    d.shell(["pkill", "-2", "screenrecord"])
                    time.sleep(0.5)
                    
                    recording_process = subprocess.Popen(
                        ["adb", "-s", serial, "shell", "screenrecord", "--time-limit", "180", video_path_phone],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL
                    )
                    print(f"🎥 Perekaman video diaktifkan di device: {video_path_phone}")
                except Exception as record_err:
                    print(f"⚠️ Gagal memulai rekaman video: {record_err}")
                
                time.sleep(1)
                
                # LOOP UTAMA UNTUK SETIAP LANGKAH (STEPS)
                for step in steps:
                    action = step.get("action")
                    print(f"➜ Menjalankan Step {step['step_number']}: {action}")
                    
                    try:
                        if action == "app_start":
                            d.app_start(step["target"])
                        elif action == "wait":
                            time.sleep(float(step["value"]))
                        elif action == "click":
                            loc_type = step.get("locator_type")
                            loc_val = step.get("locator_value")
                            if loc_type == "resource_id":
                                d(resourceId=loc_val).click(timeout=3.0)
                            elif loc_type == "text":
                                d(text=loc_val).click(timeout=3.0)
                        elif action == "type":
                            loc_val = step.get("locator_value")
                            d(resourceId=loc_val).set_text(step["value"])
                            
                    except Exception as step_error:
                        execution_status = "FAILED"
                        error_message = str(step_error)
                        failed_step_desc = f"Step {step['step_number']} ({action}) target/value: {step.get('target', '') or step.get('locator_value', '') or step.get('value', '')}"
                        print(f"❌ Step {step['step_number']} Gagal: {step_error}")
                        
                        try:
                            xml_dump_content = d.dump_hierarchy()
                            with open(ui_dump_local, "w", encoding="utf-8") as xml_file:
                                xml_file.write(xml_dump_content)
                            print(f"💾 UI Hierarchy didump ke {ui_dump_local}")
                        except Exception as dump_err:
                            print(f"⚠️ Gagal mendump UI Hierarchy: {dump_err}")
                            
                        try:
                            with open(error_log_local, "w", encoding="utf-8") as err_file:
                                err_file.write(error_message)
                        except Exception:
                            pass
                            
                        break
                
                # Hentikan perekaman video jika aktif
                if recording_process:
                    try:
                        d.shell(["pkill", "-2", "screenrecord"])
                        print("🎥 Menghentikan perekaman video di device...")
                        time.sleep(2)
                        recording_process.terminate()
                        try:
                            recording_process.wait(timeout=3)
                        except subprocess.TimeoutExpired:
                            recording_process.kill()
                    except Exception as stop_err:
                        print(f"⚠️ Gagal menghentikan rekaman video: {stop_err}")
                    
                    try:
                        d.pull(video_path_phone, video_path_local)
                        d.shell(["rm", video_path_phone])
                        print(f"📥 Video ditarik ke {video_path_local}")
                    except Exception as pull_err:
                        print(f"⚠️ Gagal menarik video: {pull_err}")
                        
            elif platform == "web":
                device_info = {
                    "model": "Chrome (Selenium Web)",
                    "os_version": "Desktop Browser",
                    "adb_serial": "N/A"
                }
                print("🌐 Inisialisasi Selenium Chrome WebDriver...")
                chrome_options = Options()
                chrome_options.add_argument("--headless")
                chrome_options.add_argument("--no-sandbox")
                chrome_options.add_argument("--disable-dev-shm-usage")
                chrome_options.add_argument("--window-size=1920,1080")
                
                service = Service(ChromeDriverManager().install())
                driver = webdriver.Chrome(service=service, options=chrome_options)
                
                for step in steps:
                    action = step.get("action")
                    print(f"➜ Menjalankan Web Step {step['step_number']}: {action}")
                    
                    try:
                        if action == "get_url" or action == "navigate":
                            driver.get(step["value"])
                            time.sleep(2)
                        elif action == "wait":
                            time.sleep(float(step["value"]))
                        elif action == "click":
                            loc_type = step.get("locator_type")
                            loc_val = step.get("locator_value")
                            by_type, locator = get_by_locator(loc_type, loc_val)
                            driver.find_element(by_type, locator).click()
                        elif action == "type":
                            loc_type = step.get("locator_type")
                            loc_val = step.get("locator_value")
                            by_type, locator = get_by_locator(loc_type, loc_val)
                            elem = driver.find_element(by_type, locator)
                            elem.clear()
                            elem.send_keys(step["value"])
                            
                    except Exception as step_error:
                        execution_status = "FAILED"
                        error_message = str(step_error)
                        failed_step_desc = f"Step {step['step_number']} ({action}) target/value: {step.get('locator_value', '') or step.get('value', '')}"
                        print(f"❌ Web Step {step['step_number']} Gagal: {step_error}")
                        
                        try:
                            xml_dump_content = driver.page_source
                            with open(ui_dump_local, "w", encoding="utf-8") as xml_file:
                                xml_file.write(xml_dump_content)
                            print(f"💾 DOM HTML didump ke {ui_dump_local}")
                        except Exception as dump_err:
                            print(f"⚠️ Gagal mendump DOM: {dump_err}")
                            
                        try:
                            driver.save_screenshot(error_screenshot_local)
                            print(f"📸 Screenshot error web disimpan di {error_screenshot_local}")
                        except Exception as ss_err:
                            print(f"⚠️ Gagal menyimpan screenshot error: {ss_err}")

                        try:
                            with open(error_log_local, "w", encoding="utf-8") as err_file:
                                err_file.write(error_message)
                        except Exception:
                            pass
                            
                        break
                
                if driver:
                    driver.quit()
                    print("🌐 Selenium Chrome WebDriver ditutup.")
                    
        except Exception as conn_error:
            execution_status = "FAILED"
            error_message = f"Gagal mengeksekusi test runner: {conn_error}"
            print(f"💥 Runner error: {conn_error}")
            if driver:
                try:
                    driver.quit()
                except:
                    pass
            
        # Susun path relatif artifacts dari workspace root untuk disimpan di database
        artifacts = {}
        rel_output_dir = os.path.relpath(output_dir, WORKSPACE_ROOT)
        
        if os.path.exists(video_path_local):
            artifacts["video_path"] = os.path.join(rel_output_dir, "video.mp4")
        if os.path.exists(ui_dump_local):
            artifacts["ui_dump_path"] = os.path.join(rel_output_dir, "ui_dump.xml")
        if os.path.exists(error_log_local):
            artifacts["error_log_path"] = os.path.join(rel_output_dir, "error.log")
        if os.path.exists(error_screenshot_local):
            artifacts["error_screenshot_path"] = os.path.join(rel_output_dir, "error_screenshot.png")
            
        # Panggil LLM Gemini jika status FAILED
        ai_summary = None
        if execution_status == "FAILED" and error_message:
            print("🤖 Mengirim error ke Gemini untuk dianalisis...")
            xml_param = xml_dump_content[:100000] if xml_dump_content else ""
            ai_summary = generate_ai_summary(error_message, xml_param, failed_step_desc or "Koneksi Device/Browser", platform=platform)
            print(f"📝 AI Summary: {ai_summary}")
            
        # Update database PostgreSQL
        update_execution(
            execution_id=execution_id,
            status=execution_status,
            device_info=device_info,
            artifacts=artifacts,
            ai_summary=ai_summary
        )
        
        print(f"🏁 Selesai. Hasil Akhir Execution ID {execution_id}: {execution_status}")

    # Tangkap timeout koneksi Redis agar loop tidak patah
    except (redis.exceptions.TimeoutError, TimeoutError):
        continue
    except Exception as general_err:
        print(f"💥 Driver/Sistem Worker mengalami error tidak terduga: {general_err}")
        time.sleep(2)