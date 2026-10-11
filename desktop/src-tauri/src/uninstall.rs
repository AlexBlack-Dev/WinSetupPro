use crate::engine::{self, RunHandle};
use crate::model::InstallEvent;
use serde::{Deserialize, Serialize};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, State};

use crate::queue::QueueState;

/// Slim uninstall request from the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UninstallItem {
    pub id: String,
    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
    pub winget_id: Option<String>,
    #[serde(default)]
    pub scoop_name: Option<String>,
    #[serde(default)]
    pub uninstall_string: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeftoverReport {
    pub registry_keys: Vec<String>,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemovedReport {
    pub removed_registry: usize,
    pub removed_paths: usize,
    pub errors: Vec<String>,
}

fn emit(app: &AppHandle, ev: InstallEvent) {
    if let Err(e) = app.emit("install-event", ev) {
        eprintln!("emit install-event failed: {e}");
    }
}

pub fn winget_uninstall_args(id: &str) -> Vec<String> {
    [
        "uninstall",
        "--exact",
        "--id",
        id,
        "--silent",
        "--disable-interactivity",
        "--accept-source-agreements",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

/// Splits an UninstallString into program + args; detects MSI for silent flags.
#[derive(Debug, PartialEq, Eq)]
pub enum UninstallPlan {
    Msiexec { product: String },
    Unsupported,
}

pub fn classify_uninstall_string(raw: &str) -> UninstallPlan {
    let t = raw.trim().trim_matches('"').trim();
    let lower = t.to_ascii_lowercase();
    if lower.starts_with("msiexec") {
        let mut product = String::new();
        let mut chars = t.chars().peekable();
        while let Some(c) = chars.next() {
            if c == '{' {
                product.push(c);
                for c2 in chars.by_ref() {
                    product.push(c2);
                    if c2 == '}' {
                        break;
                    }
                }
                break;
            }
        }
        if product.is_empty() {
            for token in t.split_whitespace().skip(1) {
                let tok = token.trim_matches('"');
                if tok.eq_ignore_ascii_case("/x")
                    || tok.eq_ignore_ascii_case("/uninstall")
                    || tok.starts_with('/')
                {
                    continue;
                }
                product = tok.to_string();
                break;
            }
        }
        return UninstallPlan::Msiexec { product };
    }
    UninstallPlan::Unsupported
}

fn msiexec_args(product: &str) -> Vec<String> {
    vec![
        "/x".to_string(),
        product.to_string(),
        "/qn".to_string(),
        "/norestart".to_string(),
    ]
}

/// Sequential uninstall queue: shares QueueState::running with installs
/// so install and uninstall never run in parallel.
#[tauri::command]
pub async fn start_uninstall(
    app: AppHandle,
    state: State<'_, QueueState>,
    items: Vec<UninstallItem>,
) -> Result<(), String> {
    if items.is_empty() {
        return Err("nothing to uninstall".to_string());
    }
    if items.len() > 500 {
        return Err("too many items".to_string());
    }
    if state.running.swap(true, Ordering::SeqCst) {
        return Err("install already running".to_string());
    }
    state.handle.reset();
    let st = state.inner().clone();
    let handle = st.handle.clone();
    let log_file = st.log_file.clone();
    *log_file.lock().await = crate::support::new_run_log();

    tokio::spawn(async move {
        let total = items.len();
        let mut done = 0usize;
        for it in &items {
            if handle.is_cancelled() {
                emit(
                    &app,
                    InstallEvent::Status {
                        item: it.id.clone(),
                        status: "cancelled".to_string(),
                        progress: 0.0,
                    },
                );
                done += 1;
                emit(&app, InstallEvent::Overall { done, total });
                continue;
            }
            emit(
                &app,
                InstallEvent::Status {
                    item: it.id.clone(),
                    status: "running".to_string(),
                    progress: 0.0,
                },
            );
            run_one(&app, &handle, &log_file, it).await;
            done += 1;
            emit(&app, InstallEvent::Overall { done, total });
        }
        emit(&app, InstallEvent::Finished);
        st.running.store(false, Ordering::SeqCst);
    });
    Ok(())
}

async fn run_one(
    app: &AppHandle,
    handle: &RunHandle,
    log_file: &std::sync::Arc<tokio::sync::Mutex<Option<std::path::PathBuf>>>,
    it: &UninstallItem,
) {
    let file_slot = log_file.clone();
    let log = |message: String| {
        let kind = if message.starts_with("ERR:") {
            "error"
        } else {
            "info"
        };
        emit(
            app,
            InstallEvent::Log {
                item: it.id.clone(),
                message: message.clone(),
                kind: kind.to_string(),
            },
        );
        crate::support::append_run_log(&file_slot, &format!("[{}] {message}", it.id));
    };
    let mut log = log;

    if let Some(id) = it.winget_id.as_deref().filter(|s| !s.trim().is_empty()) {
        log(format!("winget uninstall {id}"));
        let resolved = engine::Resolved::Direct(engine::resolve_winget());
        let args = winget_uninstall_args(id);
        let ok = engine::install(handle, &resolved, &args, &mut log).await;
        finish(
            Finish {
                app,
                handle,
                item_id: &it.id,
                resolved: &resolved,
                winget: true,
                ref_id: id,
            },
            ok,
        )
        .await;
        return;
    }
    if let Some(name) = it.scoop_name.as_deref().filter(|s| !s.trim().is_empty()) {
        log(format!("scoop uninstall {name}"));
        let resolved = engine::resolve_scoop();
        let args = vec!["uninstall".to_string(), name.to_string()];
        let ok = engine::install(handle, &resolved, &args, &mut log).await;
        finish(
            Finish {
                app,
                handle,
                item_id: &it.id,
                resolved: &resolved,
                winget: false,
                ref_id: name,
            },
            ok,
        )
        .await;
        return;
    }
    if let Some(raw) = it.uninstall_string.as_deref().filter(|s| !s.trim().is_empty()) {
        match classify_uninstall_string(raw) {
            UninstallPlan::Msiexec { product } if !product.is_empty() => {
                log(format!("msiexec /x {product} /qn"));
                let resolved = engine::Resolved::Direct("msiexec".to_string());
                let ok =
                    engine::install(handle, &resolved, &msiexec_args(&product), &mut log).await;
                if ok {
                    emit_done(app, &it.id, "succeeded", 100.0, "Uninstalled cleanly.");
                } else if handle.is_cancelled() {
                    emit_done(app, &it.id, "cancelled", 0.0, "Cancelled by user.");
                } else {
                    emit_done(
                        app,
                        &it.id,
                        "failed",
                        0.0,
                        "MSI uninstaller reported an error. Leftovers can still be cleaned.",
                    );
                }
                return;
            }
            _ => {
                emit_done(
                    app,
                    &it.id,
                    "failed",
                    0.0,
                    "No silent uninstaller: run the vendor uninstaller manually, then clean leftovers.",
                );
                return;
            }
        }
    }
    emit(
        app,
        InstallEvent::Log {
            item: it.id.clone(),
            message: "ERR: nothing to uninstall with (no winget/scoop/msi)".to_string(),
            kind: "error".to_string(),
        },
    );
    emit(
        app,
        InstallEvent::Status {
            item: it.id.clone(),
            status: "failed".to_string(),
            progress: 0.0,
        },
    );
}

struct Finish<'a> {
    app: &'a AppHandle,
    handle: &'a RunHandle,
    item_id: &'a str,
    resolved: &'a engine::Resolved,
    winget: bool,
    ref_id: &'a str,
}

async fn finish(f: Finish<'_>, ok: bool) {
    let app = f.app;
    if ok {
        emit_done(app, f.item_id, "succeeded", 100.0, "Uninstalled cleanly.");
    } else if f.handle.is_cancelled() {
        emit_done(app, f.item_id, "cancelled", 0.0, "Cancelled by user.");
    } else if !engine::is_installed(f.resolved, f.winget, f.ref_id).await {
        emit_done(app, f.item_id, "succeeded", 100.0, "Gone (verified).");
    } else {
        emit_done(
            app,
            f.item_id,
            "failed",
            0.0,
            "Uninstaller reported an error. Leftovers can still be cleaned.",
        );
    }
}

fn emit_done(app: &AppHandle, id: &str, status: &str, progress: f64, message: &str) {
    let kind = if status == "failed" { "error" } else { "success" };
    emit(
        app,
        InstallEvent::Log {
            item: id.to_string(),
            message: message.to_string(),
            kind: kind.to_string(),
        },
    );
    emit(
        app,
        InstallEvent::Status {
            item: id.to_string(),
            status: status.to_string(),
            progress,
        },
    );
}

pub fn normalize_name(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect()
}

/// Best-effort leftover scan: Uninstall registry keys + well-known app dirs.
/// Never touches anything outside the allowlist enforced in remove_leftovers.
#[tauri::command]
pub fn scan_leftovers(display_name: String, publisher: String) -> Result<LeftoverReport, String> {
    if display_name.trim().is_empty() || display_name.len() > 256 {
        return Err("bad display name".to_string());
    }
    if publisher.len() > 256 {
        return Err("bad publisher".to_string());
    }
    let norm = normalize_name(&display_name);
    if norm.len() < 3 {
        return Err("name too generic".to_string());
    }
    #[cfg(target_os = "windows")]
    let mut registry_keys: Vec<String> = find_uninstall_keys(&norm);
    #[cfg(not(target_os = "windows"))]
    let mut registry_keys: Vec<String> = {
        let _ = &norm;
        Vec::new()
    };
    let mut paths: Vec<String> = Vec::new();

    for dir in app_dirs(&norm) {
        if dir.is_dir() || dir.is_file() {
            paths.push(dir.to_string_lossy().into_owned());
        }
    }
    registry_keys.sort();
    registry_keys.dedup();
    paths.sort();
    paths.dedup();
    if registry_keys.len() > 200 || paths.len() > 200 {
        return Err("too many leftovers".to_string());
    }
    Ok(LeftoverReport {
        registry_keys,
        paths,
    })
}

#[cfg(target_os = "windows")]
fn find_uninstall_keys(norm: &str) -> Vec<String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let hives: [(winreg::HKEY, &str); 3] = [
        (HKEY_LOCAL_MACHINE, "HKLM"),
        (HKEY_LOCAL_MACHINE, "HKLM"),
        (HKEY_CURRENT_USER, "HKCU"),
    ];
    let subs = [
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    ];
    let mut out = Vec::new();
    for (i, (hive, tag)) in hives.iter().enumerate() {
        let sub = subs[i];
        let root = match RegKey::predef(*hive).open_subkey(sub) {
            Ok(k) => k,
            Err(_) => continue,
        };
        for name in root.enum_keys().filter_map(Result::ok) {
            let key = match root.open_subkey(&name) {
                Ok(k) => k,
                Err(_) => continue,
            };
            let display: String = key.get_value("DisplayName").unwrap_or_default();
            if display.trim().is_empty() {
                continue;
            }
            if normalize_name(&display).contains(norm)
                || norm.contains(normalize_name(&display).as_str())
            {
                out.push(format!("{tag}\\{sub}\\{name}"));
            }
        }
    }
    out
}

fn app_dirs(norm: &str) -> Vec<std::path::PathBuf> {
    let mut roots: Vec<std::path::PathBuf> = Vec::new();
    for var in ["ProgramFiles", "ProgramFiles(x86)", "ProgramData", "APPDATA", "LOCALAPPDATA"] {
        if let Ok(p) = std::env::var(var) {
            let pb = std::path::PathBuf::from(p);
            if pb.is_dir() {
                roots.push(pb);
            }
        }
    }
    let mut out = Vec::new();
    for root in roots {
        let entries = match std::fs::read_dir(&root) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.filter_map(Result::ok) {
            let fname = entry.file_name().to_string_lossy().into_owned();
            let fnorm = normalize_name(&fname);
            if fnorm.len() >= 3 && (fnorm.contains(norm) || norm.contains(fnorm.as_str())) {
                out.push(entry.path());
            }
        }
    }
    out
}

fn registry_allowlisted(key: &str) -> bool {
    let k = key.trim();
    if k.is_empty() || k.len() > 512 {
        return false;
    }
    let up = k.to_ascii_uppercase();
    if up.contains("..") || up.contains('/') {
        return false;
    }
    let prefixes = [
        "HKLM\\SOFTWARE\\MICROSOFT\\WINDOWS\\CURRENTVERSION\\UNINSTALL\\",
        "HKCU\\SOFTWARE\\MICROSOFT\\WINDOWS\\CURRENTVERSION\\UNINSTALL\\",
        "HKLM\\SOFTWARE\\WOW6432NODE\\MICROSOFT\\WINDOWS\\CURRENTVERSION\\UNINSTALL\\",
    ];
    let mut tail: Option<&str> = None;
    for p in prefixes {
        if up.starts_with(p) {
            tail = Some(&k[p.len()..]);
            break;
        }
    }
    match tail {
        Some(t) => !t.trim().is_empty() && !t.contains('\\'),
        None => false,
    }
}

fn path_allowlisted(p: &std::path::Path) -> bool {
    let roots: Vec<std::path::PathBuf> = ["ProgramFiles", "ProgramFiles(x86)", "ProgramData", "APPDATA", "LOCALAPPDATA"]
        .iter()
        .filter_map(|v| std::env::var(v).ok())
        .map(std::path::PathBuf::from)
        .collect();
    if !roots.iter().any(|r| p.starts_with(r)) {
        return false;
    }
    !matches!(p.components().count(), 0..=2)
}

/// Deletes only allowlisted leftovers. Every refusal is reported, never silent.
#[tauri::command]
pub fn remove_leftovers(
    registry_keys: Vec<String>,
    paths: Vec<String>,
) -> Result<RemovedReport, String> {
    if registry_keys.len() + paths.len() > 400 {
        return Err("too many leftovers".to_string());
    }
    let mut removed_registry = 0usize;
    let mut removed_paths = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for key in registry_keys.iter().take(200) {
        if !registry_allowlisted(key) {
            errors.push(format!("refused registry: {key}"));
            continue;
        }
        match delete_registry_key(key) {
            Ok(()) => removed_registry += 1,
            Err(e) => errors.push(format!("{key}: {e}")),
        }
    }
    for raw in paths.iter().take(200) {
        let p = std::path::PathBuf::from(raw);
        if !path_allowlisted(&p) {
            errors.push(format!("refused path: {raw}"));
            continue;
        }
        match remove_path(&p) {
            Ok(()) => removed_paths += 1,
            Err(e) => errors.push(format!("{raw}: {e}")),
        }
    }
    if errors.len() > 50 {
        errors.truncate(50);
    }
    Ok(RemovedReport {
        removed_registry,
        removed_paths,
        errors,
    })
}

#[cfg(target_os = "windows")]
fn delete_registry_key(full: &str) -> Result<(), String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let (hive, sub) = if let Some(rest) = full.strip_prefix("HKLM\\") {
        (HKEY_LOCAL_MACHINE, rest.to_string())
    } else if let Some(rest) = full.strip_prefix("HKCU\\") {
        (HKEY_CURRENT_USER, rest.to_string())
    } else {
        return Err("unknown hive".to_string());
    };
    let (parent_path, leaf) = match sub.rfind('\\') {
        Some(i) => (sub[..i].to_string(), sub[i + 1..].to_string()),
        None => return Err("bad key".to_string()),
    };
    if leaf.trim().is_empty() {
        return Err("refusing empty leaf".to_string());
    }
    let parent = RegKey::predef(hive)
        .open_subkey_with_flags(&parent_path, KEY_WRITE)
        .map_err(|e| e.to_string())?;
    parent
        .delete_subkey_all(&leaf)
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "windows"))]
fn delete_registry_key(_full: &str) -> Result<(), String> {
    Err("registry cleanup is Windows-only".to_string())
}

fn remove_path(p: &std::path::Path) -> Result<(), String> {
    if !p.exists() {
        return Ok(());
    }
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn winget_uninstall_args_are_silent() {
        let a = winget_uninstall_args("7zip.7zip");
        assert!(a.contains(&"uninstall".to_string()));
        assert!(a.contains(&"--silent".to_string()));
        assert!(a.contains(&"7zip.7zip".to_string()));
    }

    #[test]
    fn msi_strings_detected() {
        match classify_uninstall_string("MsiExec.exe /I{12345678-1234-1234-1234-1234567890AB}") {
            UninstallPlan::Msiexec { product } => assert!(product.contains('{')),
            UninstallPlan::Unsupported => panic!("msi must detect"),
        }
        assert_eq!(
            classify_uninstall_string("\"C:\\App\\uninstall.exe\" /S"),
            UninstallPlan::Unsupported
        );
    }

    #[test]
    fn registry_allowlist_is_strict() {
        assert!(registry_allowlisted(
            "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{GUID}"
        ));
        assert!(!registry_allowlisted(
            "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
        ));
        assert!(!registry_allowlisted("HKLM\\SOFTWARE\\Microsoft\\Windows"));
        assert!(!registry_allowlisted("HKLM\\SOFTWARE\\Foo\\Bar"));
        assert!(!registry_allowlisted("HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\A\\B"));
    }

    #[test]
    fn names_normalize() {
        assert_eq!(normalize_name("7-Zip 26.00 (x64)"), "7zip2600x64");
        assert!(normalize_name("ab").len() < 3);
    }
}
