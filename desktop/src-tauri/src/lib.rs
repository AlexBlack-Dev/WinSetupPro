mod catalog;
mod engine;
mod inventory;
mod model;
mod queue;
mod settings;
mod system;

use crate::model::EngineStatus;
use queue::QueueState;

#[tauri::command]
async fn check_engines() -> EngineStatus {
    EngineStatus {
        winget: engine::check_available(&engine::Resolved::Direct(
            engine::resolve_winget(),
        ))
        .await,
        scoop: engine::check_available(&engine::resolve_scoop()).await,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(QueueState::new())
        .invoke_handler(tauri::generate_handler![
            catalog::load_catalog,
            settings::get_settings,
            settings::save_settings,
            settings::export_preset,
            settings::import_preset,
            check_engines,
            engine::check_installed,
            inventory::scan_installed,
            queue::start_install,
            queue::cancel_install,
            system::is_admin,
            system::create_restore_point,
            system::restart_as_admin,
            system::install_scoop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
