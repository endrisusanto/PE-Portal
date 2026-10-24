use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
pub struct LogMessage {
    pub message: String,
    pub level: String, // "info", "warn", "error"
    pub timestamp: String,
}

#[derive(Serialize, Deserialize)]
pub struct ServiceStatus {
    pub is_running: bool,
    pub pid: Option<u32>,
    pub port: u16,
    pub uptime_seconds: u64,
}

pub struct ProcessStateInner {
    pub child: Option<Child>,
    pub start_time: Option<Instant>,
    pub is_running: Arc<AtomicBool>,
}

pub type BackendState = Arc<Mutex<ProcessStateInner>>;

fn get_now_time_str() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now();
    let duration = now
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    let h = (secs / 3600) % 24;
    let m = (secs / 60) % 60;
    let s = secs % 60;
    format!("{:02}:{:02}:{:02}", h, m, s)
}

fn find_backend_executable(app_handle: &AppHandle) -> Result<PathBuf, String> {
    // 1. Check current directory or parent bin/
    let current_dir = std::env::current_dir().unwrap_or_default();
    let candidates = [
        current_dir.join("bin").join("pe-portal-backend.exe"),
        current_dir.join("bin").join("pe-portal-backend"),
        current_dir.join("pe-portal-backend.exe"),
        current_dir.join("pe-portal-backend"),
        current_dir.join("..").join("bin").join("pe-portal-backend.exe"),
        current_dir.join("..").join("bin").join("pe-portal-backend"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Ok(candidate.canonicalize().unwrap_or_else(|_| candidate.clone()));
        }
    }

    // 2. Check bundled resource path
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let res_exe = resource_dir.join("pe-portal-backend.exe");
        if res_exe.exists() {
            return Ok(res_exe);
        }
        let res_sub = resource_dir.join("resources").join("pe-portal-backend.exe");
        if res_sub.exists() {
            return Ok(res_sub);
        }
    }

    // Fallback: look for local development build
    let dev_bin = current_dir.join("backend").join("pe-portal");
    if dev_bin.exists() {
        return Ok(dev_bin);
    }

    Ok(PathBuf::from("bin/pe-portal-backend.exe"))
}

pub async fn start_backend_inner(
    app_handle: &AppHandle,
    state: &BackendState,
) -> Result<String, String> {
    let mut lock = state.lock().await;

    // Check if already running
    if let Some(ref mut child) = lock.child {
        if let Ok(None) = child.try_wait() {
            return Ok("Backend sudah aktif berjalan.".to_string());
        }
    }

    let exe_path = find_backend_executable(app_handle)?;
    let mut cmd = Command::new(&exe_path);

    // Set working directory to project root or exe parent
    if let Some(parent) = exe_path.parent() {
        if parent.ends_with("bin") {
            if let Some(grandparent) = parent.parent() {
                cmd.current_dir(grandparent);
            }
        } else {
            cmd.current_dir(parent);
        }
    }

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    // On Windows: Launch without opening black CMD terminal window
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Gagal menjalankan {}: {}", exe_path.display(), e))?;

    let is_running_flag = lock.is_running.clone();
    is_running_flag.store(true, Ordering::SeqCst);

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let pid = child.id();
    lock.child = Some(child);
    lock.start_time = Some(Instant::now());

    // Stream stdout in background
    if let Some(out) = stdout {
        let app = app_handle.clone();
        tokio::task::spawn_blocking(move || {
            let reader = BufReader::new(out);
            for line in reader.lines().map_while(Result::ok) {
                let _ = app.emit(
                    "backend-log",
                    LogMessage {
                        message: line,
                        level: "info".to_string(),
                        timestamp: get_now_time_str(),
                    },
                );
            }
        });
    }

    // Stream stderr in background
    if let Some(err) = stderr {
        let app = app_handle.clone();
        tokio::task::spawn_blocking(move || {
            let reader = BufReader::new(err);
            for line in reader.lines().map_while(Result::ok) {
                let _ = app.emit(
                    "backend-log",
                    LogMessage {
                        message: line,
                        level: "error".to_string(),
                        timestamp: get_now_time_str(),
                    },
                );
            }
        });
    }

    let _ = app_handle.emit(
        "backend-log",
        LogMessage {
            message: format!("[SYSTEM] Service PE-Portal dimulai (PID: {}).", pid),
            level: "info".to_string(),
            timestamp: get_now_time_str(),
        },
    );

    Ok(format!("Backend berhasil dijalankan (PID: {}).", pid))
}

pub async fn stop_backend_inner(
    app_handle: &AppHandle,
    state: &BackendState,
) -> Result<String, String> {
    let mut lock = state.lock().await;

    if let Some(mut child) = lock.child.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

    lock.is_running.store(false, Ordering::SeqCst);
    lock.start_time = None;

    // On Windows: extra insurance to terminate any lingering processes by image name
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "pe-portal-backend.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }

    let _ = app_handle.emit(
        "backend-log",
        LogMessage {
            message: "[SYSTEM] Service PE-Portal telah dihentikan.".to_string(),
            level: "warn".to_string(),
            timestamp: get_now_time_str(),
        },
    );

    Ok("Service berhasil dihentikan.".to_string())
}

#[tauri::command]
async fn start_backend(
    app_handle: AppHandle,
    state: State<'_, BackendState>,
) -> Result<String, String> {
    start_backend_inner(&app_handle, state.inner()).await
}

#[tauri::command]
async fn stop_backend(
    app_handle: AppHandle,
    state: State<'_, BackendState>,
) -> Result<String, String> {
    stop_backend_inner(&app_handle, state.inner()).await
}

#[tauri::command]
async fn restart_backend(
    app_handle: AppHandle,
    state: State<'_, BackendState>,
) -> Result<String, String> {
    stop_backend_inner(&app_handle, state.inner()).await?;
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    start_backend_inner(&app_handle, state.inner()).await
}

#[tauri::command]
async fn get_service_status(state: State<'_, BackendState>) -> Result<ServiceStatus, String> {
    let mut lock = state.lock().await;

    let mut is_running = false;
    let mut pid = None;
    let mut uptime = 0;

    if let Some(ref mut child) = lock.child {
        match child.try_wait() {
            Ok(None) => {
                is_running = true;
                pid = Some(child.id());
                if let Some(start) = lock.start_time {
                    uptime = start.elapsed().as_secs();
                }
            }
            _ => {
                lock.child = None;
                lock.is_running.store(false, Ordering::SeqCst);
            }
        }
    }

    Ok(ServiceStatus {
        is_running,
        pid,
        port: 8085,
        uptime_seconds: uptime,
    })
}

#[tauri::command]
async fn open_browser_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let process_state: BackendState = Arc::new(Mutex::new(ProcessStateInner {
        child: None,
        start_time: None,
        is_running: Arc::new(AtomicBool::new(false)),
    }));

    let app = tauri::Builder::default()
        .manage(process_state.clone())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Build Tray Menu items
            let show_i = MenuItem::with_id(app, "show", "🪟 Tampilkan Manager", true, None::<&str>)?;
            let web_i = MenuItem::with_id(app, "open_web", "🌐 Buka PE-Portal (Browser)", true, None::<&str>)?;
            let start_i = MenuItem::with_id(app, "start", "▶ Start Service", true, None::<&str>)?;
            let stop_i = MenuItem::with_id(app, "stop", "⏹ Stop Service", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "❌ Keluar Aplikasi", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_i, &web_i, &start_i, &stop_i, &quit_i])?;

            let mut builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app_handle, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "open_web" => {
                            let _ = open_browser_url("http://localhost:3025".to_string());
                        }
                        "start" => {
                            let handle = app_handle.clone();
                            let state = handle.state::<BackendState>().inner().clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = start_backend_inner(&handle, &state).await;
                            });
                        }
                        "stop" => {
                            let handle = app_handle.clone();
                            let state = handle.state::<BackendState>().inner().clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = stop_backend_inner(&handle, &state).await;
                            });
                        }
                        "quit" => {
                            let handle = app_handle.clone();
                            let state = handle.state::<BackendState>().inner().clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = stop_backend_inner(&handle, &state).await;
                                handle.exit(0);
                            });
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone());
            }

            let _tray = builder.build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Prevent close on X click: hide to system tray instead!
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let _ = window.hide();
                api.prevent_close();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            start_backend,
            stop_backend,
            restart_backend,
            get_service_status,
            open_browser_url
        ]);

    app.run(tauri::generate_context!())
        .expect("error while running pe-portal desktop application");
}
