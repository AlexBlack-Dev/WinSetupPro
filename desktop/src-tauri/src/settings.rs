use crate::catalog::data_dir;
use crate::model::{AppSettings, CustomProfile};

fn path() -> std::path::PathBuf {
    data_dir().join("settings.json")
}

#[tauri::command]
pub fn get_settings() -> AppSettings {
    let raw = std::fs::read_to_string(path()).unwrap_or_default();
    serde_json::from_str::<AppSettings>(&raw)
        .unwrap_or_default()
        .normalized()
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    let dir = data_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(&settings.normalized()).map_err(|e| e.to_string())?;
    std::fs::write(path(), text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_preset(path: String, ids: Vec<String>) -> Result<(), String> {
    if path.is_empty() || path.len() > 1024 {
        return Err("bad preset path".to_string());
    }
    if ids.len() > 5000 {
        return Err("preset too large".to_string());
    }
    let mut clean: Vec<String> = ids
        .into_iter()
        .filter(|s| {
            !s.is_empty()
                && s.len() <= 64
                && s.chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
        })
        .collect();
    clean.sort();
    clean.dedup();
    let text = serde_json::to_string_pretty(&clean).map_err(|e| e.to_string())?;
    if text.len() > 200_000 {
        return Err("preset too large".to_string());
    }
    std::fs::write(path, text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_preset(path: String) -> Result<Vec<String>, String> {
    if path.is_empty() || path.len() > 1024 {
        return Err("bad preset path".to_string());
    }
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 200_000 {
        return Err("preset file too large".to_string());
    }
    let text = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let ids: Vec<String> = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    if ids.len() > 5000 {
        return Err("preset too large".to_string());
    }
    let mut clean: Vec<String> = ids
        .into_iter()
        .filter(|s| {
            !s.is_empty()
                && s.len() <= 64
                && s.chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
        })
        .collect();
    clean.sort();
    clean.dedup();
    Ok(clean)
}

#[tauri::command]
pub fn get_custom_profiles() -> Vec<CustomProfile> {
    get_settings().custom_profiles
}

#[tauri::command]
pub fn save_custom_profiles(profiles: Vec<CustomProfile>) -> Result<(), String> {
    if profiles.len() > 100 {
        return Err("too many profiles".to_string());
    }
    let mut s = get_settings();
    s.custom_profiles = profiles;
    save_settings(s)
}
