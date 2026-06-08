import sys
import os
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def run_test():
    # Setup Chrome Options agar mencatat console log browser
    options = webdriver.ChromeOptions()
    options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    
    # Jalankan headless (di background) agar tidak memunculkan jendela browser di laptopmu
    options.add_argument('--headless') 
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    
    # Otomatis download & konfigurasi ChromeDriver
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    
    artifacts = {}

    try:
        # 1. Buka halaman target
        driver.get("https://the-internet.herokuapp.com/login")
        
        # 2. SENGAJA BIKIN STUCK / ERROR
        # Mencari ID yang tidak eksis agar melempar Exception
        driver.find_element(By.ID, "tombol-yang-sengaja-salah-biar-stuck").click()
        
    except Exception as e:
        # 3. KETIKA ERROR: Tangkap data ala Jam.dev
        os.makedirs("outputs", exist_ok=True)
        
        # Ambil Screenshot
        screenshot_path = "outputs/error_screenshot.png"
        driver.save_screenshot(screenshot_path)
        
        # Ambil Browser Console Logs
        browser_logs = driver.get_log('browser')
        
        artifacts = {
            "status": "FAILED",
            "error_message": str(e).split("\n")[0], # Ambil baris pertama error saja biar rapi
            "screenshot_path": screenshot_path,
            "console_logs": browser_logs
        }

    finally:
        driver.quit()
        
        # Cetak hasil JSON ke stdout agar bisa ditangkap oleh Rust
        print(json.dumps(artifacts))

if __name__ == "__main__":
    run_test()