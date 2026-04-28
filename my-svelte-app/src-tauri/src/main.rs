// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        // SQLite plugin for local database access
        .plugin(tauri_plugin_sql::Builder::default().build())
        // Native notification plugin
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // System tray setup
            #[cfg(desktop)]
            {
                use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
                let tray = TrayIconBuilder::new()
                    .tooltip("JTS-IMS")
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
                let _ = tray;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running JTS-IMS");
}
