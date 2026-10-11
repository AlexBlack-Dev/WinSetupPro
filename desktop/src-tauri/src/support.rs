use crate::engine::no_window;
use serde::Serialize;
use tokio::time::{timeout, Duration};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub latest: String,
    pub notes: String,
    pub url: String,
    pub available: bool,
}

fn semver(s: &str) -> [u64; 3] {
    let mut out = [0u64; 3];
    for (i, part) in s.trim().trim_start_matches('v').split('.').take(3).enumerate() {
        out[i] = part.parse().unwrap_or(0);
    }
    out
}

pub fn is_newer(current: &str, latest: &str) -> bool {
    semver(latest) > semver(current)
}

fn truncate(s: &mut String, max: usize) {
    if s.len() > max {
        let mut end = max;
        while !s.is_char_boundary(end) {
            end -= 1;
        }
        s.truncate(end);
    }
}

/// Checks GitHub Releases for a newer tag. Read-only, 20s timeout.
#[tauri::command]
pub async fn check_update(current: String) -> Result<UpdateInfo, String> {
    if current.len() > 32 {
        return Err("bad version".to_string());
    }
    let mut cmd = crate::system::shell_cmd();
    no_window(&mut cmd);
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$r=Invoke-RestMethod -Uri 'https://api.github.com/repos/AlexBlack-Dev/WinSetupPro/releases/latest' -Headers @{'User-Agent'='WinSetupPro'} -TimeoutSec 20;@{tag=\"$($r.tag_name)\";notes=\"$($r.body)\";url=\"$($r.html_url)\"}|ConvertTo-Json -Compress",
    ]);
    let out = timeout(Duration::from_secs(30), cmd.output())
        .await
        .map_err(|_| "update check timed out".to_string())?
        .map_err(|e| format!("spawn powershell: {e}"))?;
    if !out.status.success() {
        return Err("update check failed (no network?)".to_string());
    }
    let v: serde_json::Value =
        serde_json::from_str(&String::from_utf8_lossy(&out.stdout)).map_err(|e| e.to_string())?;
    let tag = v
        .get("tag")
        .and_then(|x| x.as_str())
        .unwrap_or_default()
        .to_string();
    if tag.is_empty() || tag.len() > 32 {
        return Err("no releases yet".to_string());
    }
    let mut notes = v
        .get("notes")
        .and_then(|x| x.as_str())
        .unwrap_or_default()
        .to_string();
    truncate(&mut notes, 2000);
    let url = v
        .get("url")
        .and_then(|x| x.as_str())
        .filter(|u| u.starts_with("https://github.com/AlexBlack-Dev/WinSetupPro/"))
        .unwrap_or("https://github.com/AlexBlack-Dev/WinSetupPro/releases/latest")
        .to_string();
    Ok(UpdateInfo {
        available: is_newer(&current, &tag),
        latest: tag,
        notes,
        url,
    })
}

pub fn logs_dir() -> std::path::PathBuf {
    crate::catalog::data_dir().join("logs")
}

/// Creates a fresh run log, pruning older ones to the last 10.
pub fn new_run_log() -> Option<std::path::PathBuf> {
    let dir = logs_dir();
    std::fs::create_dir_all(&dir).ok()?;
    if let Ok(entries) = std::fs::read_dir(&dir) {
        let mut files: Vec<_> = entries
            .filter_map(Result::ok)
            .map(|e| e.path())
            .filter(|p| {
                p.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with("run-") && n.ends_with(".txt"))
                    .unwrap_or(false)
            })
            .collect();
        files.sort();
        while files.len() >= 10 {
            if let Some(old) = files.first() {
                let _ = std::fs::remove_file(old);
            }
            files.remove(0);
        }
    }
    let path = dir.join(format!(
        "run-{}.txt",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    ));
    std::fs::write(&path, "WinSetupPro run log\n").ok()?;
    Some(path)
}

pub fn append_run_log(
    slot: &std::sync::Arc<tokio::sync::Mutex<Option<std::path::PathBuf>>>,
    line: &str,
) {
    if let Ok(g) = slot.try_lock() {
        if let Some(path) = g.as_ref() {
            if let Ok(mut f) = std::fs::OpenOptions::new().append(true).open(path) {
                use std::io::Write;
                let _ = writeln!(f, "{line}");
            }
        }
    }
}

#[tauri::command]
pub fn open_logs_dir() -> Result<String, String> {
    let dir = logs_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newer_detection() {
        assert!(is_newer("0.2.0", "v0.3.0"));
        assert!(is_newer("0.2.0", "0.2.1"));
        assert!(!is_newer("0.3.0", "0.2.9"));
        assert!(!is_newer("0.2.0", "0.2.0"));
        assert!(!is_newer("0.2.0", "garbage"));
    }
}
