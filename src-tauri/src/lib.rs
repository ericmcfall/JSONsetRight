// Entry point for the Rust side of SafeJSON.
// File reading/writing, backups and recovery commands get registered here in Phase 1.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
