mod catalog;
mod engine;
mod inventory;
mod model;
mod optimizer;
mod queue;
mod settings;
mod support;
mod system;
mod uninstall;

use crate::model::EngineStatus;
use queue::QueueState;

fn apply_cli_preset() {
    let mut args = std::env::args().skip(1);
    let mut preset: Option<String> = None;
    while let Some(a) = args.next() {
        if a == "--preset" {
            preset = args.next();
        }
    }
    let Some(path) = preset else { return };
    let ids = match settings::import_preset(path) {
        Ok(ids) => ids,
        Err(e) => {
            eprintln!("--preset import failed: {e}");
            return;
        }
    };
    let mut s = settings::get_settings();
    for id in ids {
        if !s.selected_ids.contains(&id) {
            s.selected_ids.push(id);
        }
    }
    if let Err(e) = settings::save_settings(s) {
        eprintln!("--preset save failed: {e}");
    }
}

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
    // IT preset: `WinSetupPro.exe --preset path.json` merges preset ids into
    // the saved selection before the UI boots. Documented in README.
    apply_cli_preset();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(QueueState::new())
        .invoke_handler(tauri::generate_handler![
            catalog::load_catalog,
            catalog::catalog_meta,
            settings::get_settings,
            settings::save_settings,
            settings::export_preset,
            settings::import_preset,
            check_engines,
            engine::check_installed,
            inventory::scan_installed,
            queue::start_install,
            queue::cancel_install,
            uninstall::start_uninstall,
            uninstall::scan_leftovers,
            uninstall::remove_leftovers,
            optimizer::system_info,
            optimizer::list_processes,
            optimizer::kill_process,
            optimizer::list_startup,
            optimizer::disable_startup,
            optimizer::list_startup_backups,
            optimizer::restore_startup_backup,
            optimizer::defender_status,
            optimizer::disk_temps,
            optimizer::clean_temps,
            optimizer::list_tweaks,
            optimizer::tweak_status,
            optimizer::apply_tweak,
            optimizer::revert_tweak,
            support::check_update,
            support::open_logs_dir,
            system::is_admin,
            system::create_restore_point,
            system::restart_as_admin,
            system::install_scoop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
