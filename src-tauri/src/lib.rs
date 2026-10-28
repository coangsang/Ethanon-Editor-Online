mod project_io;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(project_io::ProjectSessions::default())
        .invoke_handler(tauri::generate_handler![
            project_io::open_project_session,
            project_io::release_project_session,
            project_io::project_list_entries,
            project_io::project_create_directory,
            project_io::project_file_exists,
            project_io::project_read_binary,
            project_io::project_write_text,
            project_io::project_write_binary,
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
