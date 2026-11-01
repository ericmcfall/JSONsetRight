// Entry point for the Rust side of SafeJSON. The interface calls the commands listed in
// generate_handler! below (see src/platform/files.ts for the TypeScript side).
mod files;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            files::read_text_file,
            files::save_text_file,
            files::file_modified_ms,
            files::list_backups,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
