import sys
import os
import json
import time
import uiautomator2 as u2  

def run_android_test():
    output_dir = "outputs/android"
    os.makedirs(output_dir, exist_ok=True)
    
    video_path_phone = "/sdcard/automation_video.mp4"
    video_path_local = f"{output_dir}/execution_video.mp4"
    log_path_local = f"{output_dir}/logcat_dump.txt"
    ui_dump_local = f"{output_dir}/ui_hierarchy.xml"
    report_path_local = f"{output_dir}/bug_report.json"

    # 1. Hubungkan ke device via uiautomator2
    try:
        d = u2.connect('R9RY100N5CA')
        device_serial = d.serial
    except Exception as connection_error:
        print(json.dumps({"status": "ERROR", "message": f"Gagal koneksi ke uiautomator2: {str(connection_error)}"}))
        return

    # 2. Bersihkan Logcat lama via u2.shell
    d.shell(["logcat", "-c"])

    # 3. JALANKAN PEREKAMAN LAYAR DI BACKGROUND
    # u2 memiliki fungsi native d.screenrecord() yang otomatis berjalan di background
    # dan menghasilkan context manager / object yang bisa di-stop kapan saja.
    try:
        d.screenrecord(video_path_phone)
    except Exception as record_err:
        # Beberapa device butuh handling jika format tidak didukung, tapi umumnya aman
        pass
    
    time.sleep(1)
    artifacts = {}
    
    try:
        # 4. JALANKAN AUTOMATION REAL
        d.app_start("com.android.settings")
        d(packageName="com.android.settings").wait(timeout=5.0)

        # 5. AKSI YANG AKAN BIKIN ERROR / STUCK (Real Test)
        d(resourceId="com.android.settings:id/tombol-rahasia-yang-ga-ada").click(timeout=3.0)

    except Exception as e:
        # 6. KETIKA ERROR/STUCK: Hentikan rekaman video segera via native stop
        try:
            d.screenrecord.stop()
        except Exception:
            pass
        time.sleep(1)

        # 7. AMBIL DATA DUMP DARI DEVICE
        # A. Tarik file video (Menggunakan d.pull) dan hapus di HP (d.shell rm)
        try:
            d.pull(video_path_phone, video_path_local)
            d.shell(["rm", video_path_phone])
        except Exception as pull_err:
            print(f"Gagal menarik video: {pull_err}", file=sys.stderr)

        # B. Dump UI Hierarchy (Native u2)
        xml_dump = d.dump_hierarchy()
        with open(ui_dump_local, "w", encoding="utf-8") as xml_file:
            xml_file.write(xml_dump)

        # C. Ambil Logcat yang berisi Error via d.shell
        # Kita panggil logcat dump (-d) lewat shell internal u2
        logcat_output = d.shell(["logcat", "-d", "-v", "time", "*:E"]).output
        with open(log_path_local, "w", encoding="utf-8") as f:
            f.write(logcat_output)

        parsed_logs = []
        for line in logcat_output.split("\n")[-6:]:
            if line.strip():
                parsed_logs.append({
                    "timestamp": int(time.time() * 1000),
                    "level": "ERROR",
                    "tag": "AndroidRuntime",
                    "message": line.strip()
                })

        # Ambil info device real lewat uiautomator2 info
        device_info = d.device_info

        # 8. STRUKTURKAN JADI BUG_REPORT.JSON
        artifacts = {
            "status": "FAILED",
            "device_info": {
                "model": device_info.get("model", "Unknown Android Device"),
                "os_version": f"Android {device_info.get('version', '')}",
                "adb_serial": device_serial
            },
            "error_details": {
                "step": "Clicking element with resourceId: com.android.settings:id/tombol-rahasia-yang-ga-ada",
                "message": str(e).split("\n")[0]
            },
            "artifacts": {
                "video_path": video_path_local,
                "ui_dump_path": ui_dump_local,
                "log_path": log_path_local
            },
            "jam_dev_logs": parsed_logs
        }

        with open(report_path_local, "w") as f:
            json.dump(artifacts, f, indent=4)

    # Cetak JSON ke stdout agar ditangkap Rust
    print(json.dumps(artifacts))

if __name__ == "__main__":
    run_android_test()