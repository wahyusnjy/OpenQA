use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use tokio::process::Command;
use std::sync::Arc;
// Import modul tambahan untuk CORS dan Static Files
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

struct  AppState {
    db: PgPool,
    redis_client: redis::Client,
}

#[derive(Deserialize)]
struct StartTestRequest {
    device_serial: Option<String>,
}

#[derive(sqlx::FromRow, Serialize)]
struct SettingRow {
    key: String,
    value: String,
}

#[derive(sqlx::FromRow)]
struct TestCaseRow {
    platform: String,
    steps: serde_json::Value, // Menampung JSONB dari Postgres
}

#[derive(Serialize, sqlx::FromRow)]
struct ExecutionRow {
    id: i32,
    test_case_id: i32,
    status: String,
    device_info: Option<Value>,
    artifacts: Option<Value>,
    ai_summary: Option<String>,
}

#[tokio::main]

async fn main() {
    let database_url = "postgresql://gugugaga:yangadabadaknya@localhost:5432/openQA";
    let db_pool = PgPool::connect(database_url).await.expect("❌ Gagal koneksi ke PostgreSQL");
    let redis_client = redis::Client::open("redis://127.0.0.1/").expect("❌ Gagal Client Redis");

    let shared_state = Arc::new(AppState { db: db_pool, redis_client });

    // Konfigurasi CORS agar React (port 5173) diizinkan menembak Axum (port 3000)
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/run-android-test/:test_case_id", post(trigger_test_queue))
        .route("/run-test/:test_case_id", post(trigger_test_queue))
        .route("/executions", get(get_all_executions)) // Endpoint history
        .route("/settings", get(get_settings).post(update_settings))
        .route("/system-status", get(get_system_status))
        // Fitur sakti serving static file: foldermu "outputs" diserver ke URL path "/static/outputs/*"
        .nest_service("/static/outputs", ServeDir::new("outputs"))
        .layer(cors) // Pasang layer CORS
        .with_state(shared_state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    println!("🚀 [RUST] Orchestrator + Static Server aktif di http://localhost:3000");
    axum::serve(listener, app).await.unwrap();
}


async fn get_all_executions(State(state): State<Arc<AppState>>) -> Json<Value> {
    let rows = sqlx::query_as::<_, ExecutionRow>(
        "SELECT id, test_case_id, status, device_info, artifacts, ai_summary FROM test_executions ORDER BY id DESC"
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(list) => Json(json!(list)),
        Err(e) => Json(json!({"status": "ERROR", "message": format!("Gagal fetch: {}", e)})),
    }
}

async fn trigger_test_queue(
    Path(test_case_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<StartTestRequest>,
) -> Json<Value> {
    let serial = payload.device_serial.clone().unwrap_or_default();
    println!("🤖 [RUST] Menerima request test untuk Test Case ID: {} pada Device: {}", test_case_id, serial);

    // 1. Ambil data 'steps' dan 'platform' dari PostgreSQL berdasarkan test_case_id
    let row = sqlx::query_as::<_, TestCaseRow>(
        "SELECT platform, steps FROM test_cases WHERE id = $1"
    )
    .bind(test_case_id)
    .fetch_optional(&state.db)
    .await;

    let test_case_data = match row {
        Ok(Some(data)) => data,
        Ok(None) => return Json(json!({"status": "ERROR", "message": "Test Case ID tidak ditemukan di database"})),
        Err(e) => return Json(json!({"status": "ERROR", "message": format!("Database error (Select): {}", e)})),
    };

    if test_case_data.platform != "android" && test_case_data.platform != "web" {
        return Json(json!({"status": "ERROR", "message": "Test case ini bukan untuk platform Android atau Web"}));
    }

    // 2. Insert baris baru ke tabel 'test_executions' dengan status 'PENDING'
    let execution_result = sqlx::query(
        "INSERT INTO test_executions (test_case_id, status) VALUES ($1, 'PENDING') RETURNING id"
    )
    .bind(test_case_id)
    .fetch_one(&state.db)
    .await;

    let execution_id: i32 = match execution_result {
        Ok(row) => {
            use sqlx::Row; // Butuh trait ini untuk memanggil fungsi .get()
            row.get("id")  // Mengambil data kolom bernama "id" secara manual
        },
        Err(e) => return Json(json!({"status": "ERROR", "message": format!("Database error (Insert): {}", e)})),
    };

    // 3. Susun Payload untuk dilempar ke Redis Queue
    let redis_payload = json!({
        "execution_id": execution_id,
        "device_serial": serial,
        "platform": test_case_data.platform,
        "steps": test_case_data.steps // Ambil data JSONB mentah dari Postgres
    });

    // 4. Hubungkan ke Redis connection (async) dan lakukan LPUSH
    let mut redis_conn = match state.redis_client.get_tokio_connection().await {
        Ok(conn) => conn,
        Err(e) => return Json(json!({"status": "ERROR", "message": format!("Redis Connection Error: {}", e)})),
    };

    // Push ke list bernama "qa_automation_queue"
    let payload_string = redis_payload.to_string();
    
    match redis::cmd("LPUSH")
        .arg("qa_automation_queue")
        .arg(&payload_string)
        .query_async::<_, ()>(&mut redis_conn)
        .await 
    {
        Ok(_) => println!("📥 [RUST] Berhasil memasukkan Job Execution ID {} ke Redis Queue", execution_id),
        Err(e) => return Json(json!({"status": "ERROR", "message": format!("Gagal push ke Redis: {}", e)})),
    };

    // 5. Kembalikan respons CEPAT ke user (User gak perlu nunggu pengetesan selesai)
    Json(json!({
        "status": "SUCCESS",
        "message": "Test case berhasil dimasukkan ke dalam antrean",
        "execution_id": execution_id,
        "queue_status": "PENDING"
    }))
}

async fn trigger_web_test() -> Json<Value> {
    println!("🤖 Menerima request dari user. Memulai Python Worker...");

    // Menjalankan script Python via CLI Command secara Asynchronous
    // Arahkan langsung ke binary python di dalam folder .venv kamu
    let output = Command::new("workers/.venv/bin/python") 
        .arg("workers/run_web_test.py")
        .output()
        .await
        .expect("Gagal mengeksekusi Python Worker");

    // Mengambil string output (stdout) dari print() di Python
    let stdout_str = String::from_utf8_lossy(&output.stdout);
    
    // Parse string tersebut menjadi objek JSON Rust
    let json_response: Value = serde_json::from_str(&stdout_str).unwrap_or_else(|_| {
        serde_json::json!({
            "status": "ERROR",
            "message": "Gagal membaca output dari Python worker atau script crash"
        })
    });

    println!("✅ Python Worker selesai memproses. Mengirimkan log Jam.dev ke user.");
    Json(json_response)
}

#[derive(Deserialize)]
struct AndroidTestRequest { 
    device_id: String,
}

async fn trigger_android_test(Json(payload): Json<AndroidTestRequest>) -> Json<Value> {
    println!("🤖 [RUST] Menerima request Android async untuk Device ID: {}", payload.device_id);

    // 3. SEKARANG JALANKAN SECARA ASYNC DENGAN .await
    let output = Command::new("workers/.venv/bin/python")
        .arg("workers/run_android_test.py")
        .arg(&payload.device_id)
        .output() // Ini sekarang mengembalikan Future
        .await    // <--- Rust akan "menunggu" di sini tanpa mengunci thread server!
        .expect("Gagal mengeksekusi Android Python Worker");

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    
    let mut python_data: Value = match serde_json::from_str(&stdout_str) {
        Ok(data) => data,
        Err(_) => return Json(json!({"status": "ERROR", "message": "Python crash atau output corrupt"})),
    };

    println!("🧵 [RUST] Memulai proses Data Sewing...");
    
    if let Some(logs) = python_data["jam_dev_logs"].as_array_mut() {
        let mut video_relative_second = 0;
        for log in logs.iter_mut() {
            log["video_time_marker"] = json!(format!("00:{:02}", video_relative_second));
            video_relative_second += 1;
        }
    }

    python_data["orchestrator_metadata"] = json!({
        "processed_by": "Rust Axum Core v1.0 (Async Optimized)", // <--- Tandai perubahannya
        "sewing_status": "SUCCESSFUL",
        "total_captured_logs": python_data["jam_dev_logs"].as_array().map_or(0, |l| l.len())
    });

    println!("✅ [RUST] Async Data Sewing selesai.");
    Json(python_data)
}
// Helper untuk simulasi timestamp
fn target_log_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

async fn get_settings(State(state): State<Arc<AppState>>) -> Json<Value> {
    let rows = sqlx::query_as::<_, SettingRow>("SELECT key, value FROM settings")
        .fetch_all(&state.db)
        .await;

    match rows {
        Ok(list) => {
            let mut map = serde_json::Map::new();
            for row in list {
                map.insert(row.key, json!(row.value));
            }
            Json(json!(map))
        }
        Err(e) => Json(json!({"status": "ERROR", "message": format!("Gagal fetch settings: {}", e)})),
    }
}

async fn update_settings(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<Value>,
) -> Json<Value> {
    if let Some(obj) = payload.as_object() {
        for (key, val) in obj {
            let val_str = match val {
                Value::String(s) => s.clone(),
                Value::Bool(b) => b.to_string(),
                Value::Number(n) => n.to_string(),
                _ => val.to_string(),
            };
            
            let res = sqlx::query(
                "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
            )
            .bind(key)
            .bind(val_str)
            .execute(&state.db)
            .await;
            
            if let Err(e) = res {
                return Json(json!({"status": "ERROR", "message": format!("Gagal update key {}: {}", key, e)}));
            }
        }
        Json(json!({"status": "SUCCESS", "message": "Settings updated successfully"}))
    } else {
        Json(json!({"status": "ERROR", "message": "Invalid payload format"}))
    }
}

async fn get_system_status(State(state): State<Arc<AppState>>) -> Json<Value> {
    let (cpu, ram) = get_system_metrics().await;

    let postgres_status = match sqlx::query("SELECT 1").execute(&state.db).await {
        Ok(_) => "online",
        Err(_) => "offline",
    };

    let redis_status = match state.redis_client.get_tokio_connection().await {
        Ok(mut conn) => {
            let ping: Result<String, _> = redis::cmd("PING").query_async(&mut conn).await;
            if ping.is_ok() { "online" } else { "offline" }
        }
        Err(_) => "offline",
    };

    let active_workers = get_active_workers().await;

    Json(json!({
        "cpu_utilization": cpu,
        "ram_utilization": ram,
        "postgres_status": postgres_status,
        "redis_status": redis_status,
        "active_workers": active_workers,
    }))
}

async fn get_system_metrics() -> (f64, f64) {
    let cpu_usage = match Command::new("ps")
        .args(&["-A", "-o", "%cpu"])
        .output()
        .await
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let mut total_cpu = 0.0;
            for line in stdout.lines().skip(1) {
                if let Ok(val) = line.trim().parse::<f64>() {
                    total_cpu += val;
                }
            }
            let ncpu = match Command::new("sysctl")
                .args(&["-n", "hw.ncpu"])
                .output()
                .await
            {
                Ok(out) => {
                    String::from_utf8_lossy(&out.stdout).trim().parse::<f64>().unwrap_or(8.0)
                }
                Err(_) => 8.0,
            };
            (total_cpu / ncpu).min(100.0)
        }
        Err(_) => 0.0,
    };

    let mem_size = match Command::new("sysctl")
        .args(&["-n", "hw.memsize"])
        .output()
        .await
    {
        Ok(out) => {
            String::from_utf8_lossy(&out.stdout).trim().parse::<u64>().unwrap_or(8589934592)
        }
        Err(_) => 8589934592,
    };

    let mem_usage = match Command::new("vm_stat").output().await {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let mut page_size = 4096;
            let mut active = 0;
            let mut wired = 0;
            let mut compressor = 0;
            
            for line in stdout.lines() {
                if line.contains("page size of") {
                    if let Some(start) = line.find("page size of ") {
                        let sub = &line[start + 13..];
                        if let Some(end) = sub.find(" bytes") {
                            if let Ok(ps) = sub[..end].trim().parse::<u64>() {
                                page_size = ps;
                            }
                        }
                    }
                } else if line.contains("Pages active:") {
                    active = parse_vm_stat_val(line);
                } else if line.contains("Pages wired down:") {
                    wired = parse_vm_stat_val(line);
                } else if line.contains("Pages occupied by compressor:") {
                    compressor = parse_vm_stat_val(line);
                }
            }
            let used_bytes = (active + wired + compressor) * page_size;
            (used_bytes as f64 / mem_size as f64 * 100.0).min(100.0)
        }
        Err(_) => 0.0,
    };

    (cpu_usage, mem_usage)
}

fn parse_vm_stat_val(line: &str) -> u64 {
    let parts: Vec<&str> = line.split(':').collect();
    if parts.len() > 1 {
        let val_str = parts[1].trim().trim_end_matches('.');
        if let Ok(val) = val_str.parse::<u64>() {
            return val;
        }
    }
    0
}

async fn get_active_workers() -> Vec<serde_json::Value> {
    match Command::new("pgrep")
        .args(&["-f", "worker.py"])
        .output()
        .await
    {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let mut workers = Vec::new();
            for line in stdout.lines() {
                let pid_str = line.trim();
                if !pid_str.is_empty() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        workers.push(json!({
                            "name": "worker.py (Host Daemon)",
                            "pid": pid,
                            "listening": "qa_automation_queue",
                            "status": "Standby"
                        }));
                    }
                }
            }
            workers
        }
        Err(_) => vec![],
    }
}