use crate::engine::no_window;
use serde::Serialize;
use tokio::time::{timeout, Duration};

async fn ps(script: &str, secs: u64) -> Result<String, String> {
    let mut cmd = crate::system::shell_cmd();
    no_window(&mut cmd);
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);
    let out = timeout(Duration::from_secs(secs), cmd.output())
        .await
        .map_err(|_| "powershell timed out".to_string())?
        .map_err(|e| format!("spawn powershell: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

fn json_str(v: &serde_json::Value, key: &str) -> String {
    v.get(key)
        .and_then(|x| x.as_str())
        .unwrap_or_default()
        .to_string()
}

fn json_f64(v: &serde_json::Value, key: &str) -> f64 {
    v.get(key).and_then(|x| x.as_f64()).unwrap_or(0.0)
}

fn gb(bytes: f64) -> f64 {
    (bytes / 1073741824.0 * 10.0).round() / 10.0
}

// ---------- system info ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    pub name: String,
    pub total_gb: f64,
    pub free_gb: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub cpu: String,
    pub cores: u32,
    pub ram_total_gb: f64,
    pub ram_free_gb: f64,
    pub os: String,
    pub uptime_hours: f64,
    pub gpus: Vec<String>,
    pub disks: Vec<DiskInfo>,
}

#[tauri::command]
pub async fn system_info() -> Result<SystemInfo, String> {
    let raw = ps(
        "$cs=Get-CimInstance Win32_ComputerSystem;$os=Get-CimInstance Win32_OperatingSystem;$cpu=Get-CimInstance Win32_Processor|Select-Object -First 1;$g=Get-CimInstance Win32_VideoController|ForEach-Object{$_.Name};$d=Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3'|ForEach-Object{@{name=$_.DeviceID;total=[double]$_.Size;free=[double]$_.FreeSpace}};@{cpu=$cpu.Name;cores=[int]$cpu.NumberOfCores;ramTotal=[double]$cs.TotalPhysicalMemory;ramFree=[double]$os.FreePhysicalMemory*1KB;os=$os.Caption;uptimeH=[math]::Round(((Get-Date)-$os.LastBootUpTime).TotalHours,1);gpus=@($g);disks=@($d)}|ConvertTo-Json -Depth 4 -Compress",
        30,
    )
    .await?;
    let v: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(SystemInfo {
        cpu: json_str(&v, "cpu"),
        cores: v.get("cores").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
        ram_total_gb: gb(json_f64(&v, "ramTotal")),
        ram_free_gb: gb(json_f64(&v, "ramFree")),
        os: json_str(&v, "os"),
        uptime_hours: json_f64(&v, "uptimeH"),
        gpus: v
            .get("gpus")
            .and_then(|x| x.as_array())
            .map(|a| a.iter().filter_map(|g| g.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default(),
        disks: v
            .get("disks")
            .and_then(|x| x.as_array())
            .map(|a| {
                a.iter()
                    .map(|d| DiskInfo {
                        name: json_str(d, "name"),
                        total_gb: gb(json_f64(d, "total")),
                        free_gb: gb(json_f64(d, "free")),
                    })
                    .collect()
            })
            .unwrap_or_default(),
    })
}

// ---------- processes ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcInfo {
    pub name: String,
    pub pid: u32,
    pub cpu: f64,
    pub ram_mb: f64,
    pub company: String,
    pub path: String,
    pub suspicious: bool,
    pub reason: String,
}

/// Heuristic hygiene flags (NOT antivirus verdicts): temp-located binaries,
/// unsigned code running from app-data, unsigned CPU hogs.
pub fn suspicion(path: &str, company: &str, cpu: f64) -> Option<&'static str> {
    let l = path.to_ascii_lowercase();
    if l.contains("\\temp\\") || l.contains("/temp/") || l.contains("\\tmp\\") || l.ends_with("\\temp") {
        return Some("runs from temp");
    }
    let in_data = l.contains("\\appdata\\") || l.contains("\\programdata\\");
    if in_data && company.trim().is_empty() {
        return Some("unsigned, runs from app data");
    }
    if company.trim().is_empty() && cpu > 25.0 && !l.is_empty() {
        return Some("unsigned, high cpu");
    }
    None
}

/// Two one-second-apart samples: Get-Process CPU is cumulative seconds,
/// not a percentage. Delta over cores gives a real %.
#[tauri::command]
pub async fn list_processes() -> Result<Vec<ProcInfo>, String> {
    let raw = ps(
        "$c=[int]$env:NUMBER_OF_PROCESSORS;if($c -lt 1){$c=1};$s1=@{};Get-Process|ForEach-Object{$s1[$_.Id]=$_.CPU};Start-Sleep -Milliseconds 1000;@(Get-Process|ForEach-Object{$id=$_.Id;$t2=$_.CPU;$t1=$s1[$id];if($null -eq $t1){$t1=$t2};$pct=[math]::Round(([double]$t2-[double]$t1)/$c*100,1);try{$p=$_.Path}catch{$p=''};try{$co=$_.Company}catch{$co=''};@{name=$_.ProcessName;pid=$id;cpu=$pct;ram=[math]::Round([double]($_.WorkingSet64)/1MB,1);company=\"$co\";path=\"$p\"}}|Sort-Object{-[double]$_.cpu}|Select-Object -First 40)|ConvertTo-Json -Depth 3 -Compress",
        30,
    )
    .await?;
    if raw.is_empty() || raw == "null" {
        return Ok(vec![]);
    }
    let arr: Vec<serde_json::Value> =
        serde_json::from_str(&raw).map_err(|e| format!("parse processes: {e}"))?;
    Ok(arr
        .into_iter()
        .map(|p| {
            let path = json_str(&p, "path");
            let company = json_str(&p, "company");
            let cpu = json_f64(&p, "cpu");
            let reason = suspicion(&path, &company, cpu).unwrap_or("").to_string();
            ProcInfo {
                name: json_str(&p, "name"),
                pid: p.get("pid").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
                cpu,
                ram_mb: json_f64(&p, "ram"),
                company,
                path,
                suspicious: !reason.is_empty(),
                reason,
            }
        })
        .collect())
}

const PROTECTED_PROCS: &[&str] = &[
    "system", "registry", "smss", "csrss", "wininit", "services", "lsass", "winlogon",
    "svchost", "dwm", "explorer", "fontdrvhost", "sihost",
];

#[tauri::command]
pub async fn kill_process(pid: u32) -> Result<String, String> {
    if pid < 8 {
        return Err("refusing to kill a system process".to_string());
    }
    // Check + kill in ONE script so the pid cannot be recycled in between.
    let blocked = PROTECTED_PROCS
        .iter()
        .map(|p| format!("'{p}'"))
        .collect::<Vec<_>>()
        .join(",");
    let out = ps(
        &format!(
            "$p=Get-Process -Id {pid} -ErrorAction Stop;$n=$p.ProcessName;if(@({blocked}) -contains $n.ToLower()){{'REFUSED:'+$n}}else{{Stop-Process -InputObject $p -Force;'KILLED:'+$n}}"
        ),
        15,
    )
    .await
    .map_err(|_| format!("no process with pid {pid}"))?;
    if let Some(name) = out.strip_prefix("REFUSED:") {
        return Err(format!("refusing to kill protected process {name}"));
    }
    if let Some(name) = out.strip_prefix("KILLED:") {
        return Ok(name.to_string());
    }
    Err("unexpected kill output".to_string())
}

// ---------- startup ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupEntry {
    pub source: String,
    pub name: String,
    pub command: String,
    pub location: String,
}

#[cfg(target_os = "windows")]
const RUN_KEYS: [(&str, &str, bool); 6] = [
    (r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", "HKLM", true),
    (r"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce", "HKLM", true),
    (r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run", "HKLM", true),
    (r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", "HKCU", false),
    (r"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce", "HKCU", false),
    (r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run", "HKCU", false),
];

#[tauri::command]
pub fn list_startup() -> Result<Vec<StartupEntry>, String> {
    let mut out = Vec::new();
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        for (sub, tag, machine) in RUN_KEYS {
            let hive = if machine {
                HKEY_LOCAL_MACHINE
            } else {
                HKEY_CURRENT_USER
            };
            let root = match RegKey::predef(hive).open_subkey(sub) {
                Ok(k) => k,
                Err(_) => continue,
            };
            for (name, val) in root.enum_values().filter_map(Result::ok) {
                let winreg::RegValue { bytes, .. } = val;
                let cmd = String::from_utf16_lossy(
                    &bytes
                        .as_chunks::<2>()
                        .0
                        .iter()
                        .map(|c| u16::from_le_bytes(*c))
                        .collect::<Vec<_>>(),
                )
                .trim_matches('\0')
                .trim()
                .to_string();
                if cmd.len() > 4096 {
                    continue;
                }
                out.push(StartupEntry {
                    source: "registry".to_string(),
                    name,
                    command: cmd,
                    location: format!("{tag}\\{sub}"),
                });
            }
        }
        for (var, tag) in [("APPDATA", "user"), ("ProgramData", "machine")] {
            if let Ok(base) = std::env::var(var) {
                let dir = std::path::PathBuf::from(base).join(r"Microsoft\Windows\Start Menu\Programs\StartUp");
                if let Ok(entries) = std::fs::read_dir(&dir) {
                    for e in entries.filter_map(Result::ok) {
                        let p = e.path();
                        if p.is_file() {
                            out.push(StartupEntry {
                                source: "folder".to_string(),
                                name: e.file_name().to_string_lossy().into_owned(),
                                command: p.to_string_lossy().into_owned(),
                                location: format!("{tag} startup folder"),
                            });
                        }
                    }
                }
            }
        }
    }
    out.sort_by_key(|a| a.name.to_lowercase());
    if out.len() > 500 {
        out.truncate(500);
    }
    Ok(out)
}

fn run_key_allowlisted(location: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        RUN_KEYS
            .iter()
            .any(|(sub, tag, _)| location == format!("{tag}\\{sub}"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = location;
        false
    }
}

/// Every disable writes a backup first: registry values as JSON, folder
/// files as copies. Restore is a first-class command, not a manual chore.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupBackup {
    pub name: String,
    pub location: String,
    pub command: String,
    pub kind: String,
    pub file_copy: Option<String>,
    pub deleted_at: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupMeta {
    pub file: String,
    pub name: String,
    pub location: String,
    pub deleted_at: String,
}

fn backups_dir() -> std::path::PathBuf {
    crate::catalog::data_dir().join("backups")
}

fn sanitize_filename(s: &str) -> String {
    let clean: String = s
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let t = clean.trim_matches(['.', '_']).trim();
    if t.is_empty() {
        "item".to_string()
    } else {
        t.chars().take(80).collect()
    }
}

fn timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default()
}

fn write_backup(backup: &StartupBackup) -> Result<String, String> {
    let dir = backups_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = format!(
        "startup-{}-{}.json",
        sanitize_filename(&backup.name),
        timestamp()
    );
    let path = dir.join(&file);
    let text = serde_json::to_string_pretty(backup).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(file)
}

/// Disables an autorun: backs it up, then deletes a value from a Run/RunOnce
/// key or a file from a Startup folder.
#[tauri::command]
pub fn disable_startup(location: String, name: String) -> Result<(), String> {
    if name.trim().is_empty() || name.len() > 256 || name.contains('\\') || name.contains("..") {
        return Err("bad startup name".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        if run_key_allowlisted(&location) {
            let (tag, sub) = location.split_once('\\').ok_or("bad location")?;
            let hive = match tag {
                "HKLM" => HKEY_LOCAL_MACHINE,
                "HKCU" => HKEY_CURRENT_USER,
                _ => return Err("bad hive".to_string()),
            };
            let key = RegKey::predef(hive)
                .open_subkey_with_flags(sub, KEY_SET_VALUE | KEY_QUERY_VALUE)
                .map_err(|e| e.to_string())?;
            let command: String = key.get_value(&name).unwrap_or_default();
            write_backup(&StartupBackup {
                name: name.clone(),
                location: location.clone(),
                command,
                kind: "registry".to_string(),
                file_copy: None,
                deleted_at: timestamp(),
            })?;
            key.delete_value(&name).map_err(|e| e.to_string())?;
            return Ok(());
        }
        if location == "user startup folder" || location == "machine startup folder" {
            let var = if location.starts_with("user") {
                "APPDATA"
            } else {
                "ProgramData"
            };
            let base = std::env::var(var).map_err(|e| e.to_string())?;
            let file = std::path::PathBuf::from(base)
                .join(r"Microsoft\Windows\Start Menu\Programs\StartUp")
                .join(&name);
            if !file.is_file() {
                return Err("startup file not found".to_string());
            }
            let dir = backups_dir();
            std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            let copy_name = format!(
                "startup-file-{}-{}.lnk",
                sanitize_filename(&name),
                timestamp()
            );
            std::fs::copy(&file, dir.join(&copy_name)).map_err(|e| e.to_string())?;
            write_backup(&StartupBackup {
                name: name.clone(),
                location: location.clone(),
                command: file.to_string_lossy().into_owned(),
                kind: "file".to_string(),
                file_copy: Some(copy_name),
                deleted_at: timestamp(),
            })?;
            std::fs::remove_file(&file).map_err(|e| e.to_string())?;
            return Ok(());
        }
        Err("location not allowlisted".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (location, name);
        Err("startup management is Windows-only".to_string())
    }
}

fn valid_backup_file(file: &str) -> bool {
    if file.len() > 128 || file.contains('\\') || file.contains('/') || file.contains("..") {
        return false;
    }
    file.starts_with("startup-") && file.ends_with(".json")
}

#[tauri::command]
pub fn list_startup_backups() -> Result<Vec<BackupMeta>, String> {
    let dir = backups_dir();
    let mut out = Vec::new();
    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(vec![]),
    };
    for e in entries.filter_map(Result::ok) {
        let fname = e.file_name().to_string_lossy().into_owned();
        if !valid_backup_file(&fname) {
            continue;
        }
        let text = match std::fs::read_to_string(e.path()) {
            Ok(t) => t,
            Err(_) => continue,
        };
        if text.len() > 16384 {
            continue;
        }
        let b: StartupBackup = match serde_json::from_str(&text) {
            Ok(b) => b,
            Err(_) => continue,
        };
        out.push(BackupMeta {
            file: fname,
            name: b.name,
            location: b.location,
            deleted_at: b.deleted_at,
        });
        if out.len() >= 200 {
            break;
        }
    }
    out.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at).then(a.name.cmp(&b.name)));
    Ok(out)
}

#[tauri::command]
pub fn restore_startup_backup(file: String) -> Result<(), String> {
    if !valid_backup_file(&file) {
        return Err("bad backup file".to_string());
    }
    let path = backups_dir().join(&file);
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if text.len() > 16384 {
        return Err("backup too large".to_string());
    }
    let b: StartupBackup = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    if b.name.trim().is_empty() || b.name.len() > 256 || b.command.len() > 4096 {
        return Err("bad backup content".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        if b.kind == "registry" {
            if !run_key_allowlisted(&b.location) {
                return Err("backup location not allowlisted".to_string());
            }
            let (tag, sub) = b.location.split_once('\\').ok_or("bad location")?;
            let hive = match tag {
                "HKLM" => HKEY_LOCAL_MACHINE,
                "HKCU" => HKEY_CURRENT_USER,
                _ => return Err("bad hive".to_string()),
            };
            let key = RegKey::predef(hive)
                .open_subkey_with_flags(sub, KEY_SET_VALUE)
                .map_err(|e| e.to_string())?;
            key.set_value(&b.name, &b.command).map_err(|e| e.to_string())?;
            return Ok(());
        }
        if b.kind == "file" {
            let copy = b.file_copy.ok_or("backup has no file copy")?;
            if copy.contains('\\') || copy.contains('/') || copy.contains("..") {
                return Err("bad backup copy".to_string());
            }
            let var = if b.location.starts_with("user") {
                "APPDATA"
            } else if b.location.starts_with("machine") {
                "ProgramData"
            } else {
                return Err("backup location not allowlisted".to_string());
            };
            let base = std::env::var(var).map_err(|e| e.to_string())?;
            let dest = std::path::PathBuf::from(base)
                .join(r"Microsoft\Windows\Start Menu\Programs\StartUp")
                .join(&b.name);
            if dest.is_file() {
                return Err("startup file already exists".to_string());
            }
            std::fs::copy(backups_dir().join(copy), &dest).map_err(|e| e.to_string())?;
            return Ok(());
        }
        Err("unknown backup kind".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = b;
        Err("startup management is Windows-only".to_string())
    }
}

// ---------- defender (hygiene signal, not an antivirus) ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefenderStatus {
    pub available: bool,
    pub realtime: bool,
    pub signatures_ok: bool,
    pub detail: String,
}

#[tauri::command]
pub async fn defender_status() -> Result<DefenderStatus, String> {
    let raw = match ps(
        "$m=Get-MpComputerStatus -ErrorAction Stop;@{rt=[bool]$m.RealTimeProtectionEnabled;av=[int]$m.AntivirusSignatureAge;as=[int]$m.AntispywareSignatureAge}|ConvertTo-Json -Compress",
        30,
    )
    .await
    {
        Ok(s) => s,
        Err(e) => {
            return Ok(DefenderStatus {
                available: false,
                realtime: false,
                signatures_ok: false,
                detail: format!("Defender query failed: {e}"),
            })
        }
    };
    let v: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let av = v.get("av").and_then(|x| x.as_u64()).unwrap_or(99);
    let as_ = v.get("as").and_then(|x| x.as_u64()).unwrap_or(99);
    let rt = v.get("rt").and_then(|x| x.as_bool()).unwrap_or(false);
    let stale = av > 7 || as_ > 7;
    let detail = if !rt {
        "real-time protection is off".to_string()
    } else if stale {
        "signatures outdated".to_string()
    } else {
        "ok".to_string()
    };
    Ok(DefenderStatus {
        available: true,
        realtime: rt,
        signatures_ok: !stale,
        detail,
    })
}

// ---------- disk temps ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TempTarget {
    pub id: String,
    pub path: String,
    pub mb: f64,
}

fn dir_size_capped(path: &std::path::Path) -> (u64, u64) {
    let mut bytes = 0u64;
    let mut files = 0u64;
    let mut stack = vec![path.to_path_buf()];
    while let Some(dir) = stack.pop() {
        if files > 30000 {
            break;
        }
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for e in entries.filter_map(Result::ok) {
            if files > 30000 {
                break;
            }
            let meta = match std::fs::symlink_metadata(e.path()) {
                Ok(m) => m,
                Err(_) => continue,
            };
            if meta.file_type().is_symlink() {
                continue;
            }
            if meta.is_dir() {
                stack.push(e.path());
            } else {
                files += 1;
                bytes += meta.len();
            }
        }
    }
    (bytes, files)
}

fn temp_targets() -> Vec<(String, std::path::PathBuf)> {
    let mut out = Vec::new();
    if let Ok(sys) = std::env::var("SystemRoot") {
        out.push((
            "windows-temp".to_string(),
            std::path::PathBuf::from(&sys).join("Temp"),
        ));
        out.push((
            "update-cache".to_string(),
            std::path::PathBuf::from(&sys).join(r"SoftwareDistribution\Download"),
        ));
    }
    if let Ok(t) = std::env::var("TEMP") {
        out.push(("user-temp".to_string(), std::path::PathBuf::from(t)));
    }
    out
}

#[tauri::command]
pub fn disk_temps() -> Result<Vec<TempTarget>, String> {
    let mut out = Vec::new();
    for (id, path) in temp_targets() {
        if !path.is_dir() {
            continue;
        }
        let (bytes, _) = dir_size_capped(&path);
        out.push(TempTarget {
            id,
            path: path.to_string_lossy().into_owned(),
            mb: (bytes as f64 / 1048576.0 * 10.0).round() / 10.0,
        });
    }
    Ok(out)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanReport {
    pub removed_files: u64,
    pub freed_mb: f64,
    pub errors: Vec<String>,
}

#[tauri::command]
pub async fn clean_temps(ids: Vec<String>) -> Result<CleanReport, String> {
    if ids.is_empty() || ids.len() > 10 {
        return Err("bad targets".to_string());
    }
    // Windows Update locks its cache: stop the service while we clean it,
    // best-effort, and start it back afterwards.
    let touches_updates = ids.iter().any(|i| i == "update-cache");
    let mut stopped_wu = false;
    if touches_updates {
        stopped_wu = ps("Stop-Service wuauserv -Force -ErrorAction SilentlyContinue; 'ok'", 30)
            .await
            .is_ok();
    }
    let mut removed_files = 0u64;
    let mut freed = 0u64;
    let mut errors: Vec<String> = Vec::new();
    let allowed = temp_targets();
    for id in ids {
        let Some((_, dir)) = allowed.iter().find(|(i, _)| i == &id) else {
            errors.push(format!("refused target: {id}"));
            continue;
        };
        if !dir.is_dir() {
            continue;
        }
        let entries: Vec<_> = std::fs::read_dir(dir)
            .map(|r| r.filter_map(Result::ok).collect())
            .unwrap_or_default();
        for e in entries {
            let p = e.path();
            let meta = match std::fs::symlink_metadata(&p) {
                Ok(m) => m,
                Err(err) => {
                    errors.push(format!("{}: {err}", p.display()));
                    continue;
                }
            };
            if meta.file_type().is_symlink() {
                continue;
            }
            if meta.is_dir() {
                let (bytes, _) = dir_size_capped(&p);
                match std::fs::remove_dir_all(&p) {
                    Ok(()) => {
                        removed_files += 1;
                        freed += bytes;
                    }
                    Err(err) => errors.push(format!("{}: {err}", p.display())),
                }
            } else {
                let size = meta.len();
                match std::fs::remove_file(&p) {
                    Ok(()) => {
                        removed_files += 1;
                        freed += size;
                    }
                    Err(err) => errors.push(format!("{}: {err}", p.display())),
                }
            }
            if errors.len() > 20 {
                break;
            }
        }
    }
    if errors.len() > 20 {
        errors.truncate(20);
    }
    if stopped_wu {
        if let Err(e) = ps("Start-Service wuauserv -ErrorAction SilentlyContinue; 'ok'", 30).await {
            errors.push(format!("wuauserv restart: {e}"));
        }
    }
    Ok(CleanReport {
        removed_files,
        freed_mb: (freed as f64 / 1048576.0 * 10.0).round() / 10.0,
        errors,
    })
}

// ---------- tweaks (safe, reversible, allowlisted) ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TweakInfo {
    pub id: String,
    pub needs_admin: bool,
}

pub const TWEAKS: [(&str, bool); 5] = [
    ("power-ultimate", true),
    ("game-mode", false),
    ("visual-performance", false),
    ("telemetry-basic", true),
    ("background-apps", false),
];

pub fn tweak_known(id: &str) -> bool {
    TWEAKS.iter().any(|(i, _)| *i == id)
}

#[tauri::command]
pub fn list_tweaks() -> Vec<TweakInfo> {
    TWEAKS
        .iter()
        .map(|(id, admin)| TweakInfo {
            id: id.to_string(),
            needs_admin: *admin,
        })
        .collect()
}

#[tauri::command]
pub async fn tweak_status(id: String) -> Result<bool, String> {
    if !tweak_known(&id) {
        return Err("unknown tweak".to_string());
    }
    match id.as_str() {
        "power-ultimate" => Ok(ps("powercfg /getactivescheme", 15)
            .await
            .map(|s| s.to_ascii_lowercase().contains("e9a42b02"))
            .unwrap_or(false)),
        "game-mode" => Ok(read_reg_dword(
            "HKCU",
            r"SOFTWARE\Microsoft\GameBar",
            "AllowAutoGameMode",
        ) == Some(1)),
        "visual-performance" => Ok(read_reg_dword(
            "HKCU",
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects",
            "VisualFXSetting",
        ) == Some(2)),
        "telemetry-basic" => Ok(read_reg_dword(
            "HKLM",
            r"SOFTWARE\Policies\Microsoft\Windows\DataCollection",
            "AllowTelemetry",
        ) == Some(1)),
        "background-apps" => Ok(read_reg_dword(
            "HKCU",
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications",
            "GlobalUserDisabled",
        ) == Some(1)),
        _ => Err("unknown tweak".to_string()),
    }
}

#[tauri::command]
pub async fn apply_tweak(id: String) -> Result<(), String> {
    if !tweak_known(&id) {
        return Err("unknown tweak".to_string());
    }
    match id.as_str() {
        "power-ultimate" => {
            let schemes = ps("powercfg /list", 15).await.unwrap_or_default().to_ascii_lowercase();
            if !schemes.contains("e9a42b02") {
                ps("powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61", 30).await?;
            }
            ps("powercfg -setactive e9a42b02-d5df-448d-aa00-03f14749eb61", 15)
                .await
                .map(|_| ())
        }
        "game-mode" => write_reg_dword(
            "HKCU",
            r"SOFTWARE\Microsoft\GameBar",
            "AllowAutoGameMode",
            1,
        )
        .await
        .map(|_| ()),
        "visual-performance" => write_reg_dword(
            "HKCU",
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects",
            "VisualFXSetting",
            2,
        )
        .await
        .map(|_| ()),
        "telemetry-basic" => write_reg_dword(
            "HKLM",
            r"SOFTWARE\Policies\Microsoft\Windows\DataCollection",
            "AllowTelemetry",
            1,
        )
        .await
        .map(|_| ()),
        "background-apps" => write_reg_dword(
            "HKCU",
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications",
            "GlobalUserDisabled",
            1,
        )
        .await
        .map(|_| ()),
        _ => Err("unknown tweak".to_string()),
    }
}

#[tauri::command]
pub async fn revert_tweak(id: String) -> Result<(), String> {
    if !tweak_known(&id) {
        return Err("unknown tweak".to_string());
    }
    match id.as_str() {
        "power-ultimate" => ps("powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e", 15)
            .await
            .map(|_| ()),
        "game-mode" => write_reg_dword(
            "HKCU",
            r"SOFTWARE\Microsoft\GameBar",
            "AllowAutoGameMode",
            0,
        )
        .await
        .map(|_| ()),
        "visual-performance" => write_reg_dword(
            "HKCU",
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects",
            "VisualFXSetting",
            0,
        )
        .await
        .map(|_| ()),
        "telemetry-basic" => write_reg_dword(
            "HKLM",
            r"SOFTWARE\Policies\Microsoft\Windows\DataCollection",
            "AllowTelemetry",
            3,
        )
        .await
        .map(|_| ()),
        "background-apps" => write_reg_dword(
            "HKCU",
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications",
            "GlobalUserDisabled",
            0,
        )
        .await
        .map(|_| ()),
        _ => Err("unknown tweak".to_string()),
    }
}

#[cfg(target_os = "windows")]
fn read_reg_dword(hive: &str, sub: &str, value: &str) -> Option<u32> {
    use winreg::enums::*;
    use winreg::RegKey;
    let h = match hive {
        "HKLM" => HKEY_LOCAL_MACHINE,
        _ => HKEY_CURRENT_USER,
    };
    RegKey::predef(h)
        .open_subkey(sub)
        .ok()?
        .get_value::<u32, _>(value)
        .ok()
}

#[cfg(not(target_os = "windows"))]
fn read_reg_dword(_hive: &str, _sub: &str, _value: &str) -> Option<u32> {
    None
}

async fn write_reg_dword(hive: &str, sub: &str, value: &str, data: u32) -> Result<String, String> {
    if hive != "HKCU" && hive != "HKLM" {
        return Err("bad hive".to_string());
    }
    if sub.len() > 256 || value.len() > 64 {
        return Err("bad key".to_string());
    }
    ps(
        &format!("New-Item -Path '{hive}:{sub}' -Force | Out-Null; New-ItemProperty -Path '{hive}:{sub}' -Name '{value}' -Value {data} -PropertyType DWord -Force | Out-Null; 'ok'"),
        20,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suspicion_flags_temp() {
        assert_eq!(
            suspicion("C:\\Users\\A\\AppData\\Local\\Temp\\evil.exe", "", 1.0),
            Some("runs from temp")
        );
        assert_eq!(suspicion("C:\\Windows\\explorer.exe", "Microsoft", 2.0), None);
    }

    #[test]
    fn suspicion_flags_unsigned_appdata() {
        assert_eq!(
            suspicion("C:\\Users\\A\\AppData\\Roaming\\x\\x.exe", "", 3.0),
            Some("unsigned, runs from app data")
        );
        assert_eq!(
            suspicion("C:\\Users\\A\\AppData\\Roaming\\x\\x.exe", "Vendor", 90.0),
            None
        );
    }

    #[test]
    fn protected_list_covers_system() {
        for p in ["system", "csrss", "lsass", "svchost", "explorer", "dwm"] {
            assert!(PROTECTED_PROCS.contains(&p));
        }
    }

    #[test]
    fn tweaks_are_known_and_bounded() {
        assert_eq!(TWEAKS.len(), 5);
        assert!(tweak_known("power-ultimate"));
        assert!(!tweak_known("delete-system32"));
    }

    #[test]
    fn backup_filenames_are_safe() {
        assert!(valid_backup_file("startup-foo-123.json"));
        assert!(!valid_backup_file("../evil.json"));
        assert!(!valid_backup_file("startup-a/b.json"));
        assert!(!valid_backup_file("other-foo.json"));
        assert_eq!(sanitize_filename("../../x"), "x");
        assert_eq!(sanitize_filename(""), "item");
    }
}
