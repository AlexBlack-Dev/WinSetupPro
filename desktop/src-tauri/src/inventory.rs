use serde::Serialize;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub name: String,
    pub version: String,
    pub publisher: String,
    pub source: String,
    pub winget_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uninstall_string: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub registry_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub install_location: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryReport {
    pub apps: Vec<InstalledApp>,
    pub winget_ids: Vec<String>,
    pub total: usize,
}

/// Parses `winget list` table output using header column offsets (robust
/// against spaces inside names, since columns are position-aligned).
pub fn parse_winget_table(text: &str) -> Vec<InstalledApp> {
    let mut lines = text.lines().peekable();
    // Find the header row: starts with "Name" and contains "Id".
    let mut header: Option<&str> = None;
    for line in lines.by_ref() {
        let t = line.trim_start();
        if t.starts_with("Name") && t.contains("Id") {
            header = Some(line);
            break;
        }
    }
    let header = match header {
        Some(h) => h,
        None => return vec![],
    };
    let col = |label: &str| header.find(label).unwrap_or(usize::MAX);
    let (c_id, c_ver, c_avail, c_src) =
        (col("Id"), col("Version"), col("Available"), col("Source"));
    // Skip the dashes separator line.
    if lines
        .peek()
        .map(|l| l.trim().chars().all(|c| c == '-' || c == ' '))
        .unwrap_or(false)
    {
        lines.next();
    }
    let mut out = Vec::new();
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        // Pad short rows so slicing never panics.
        let padded = format!("{line:<width$}", width = header.len().max(line.len()));
        let cut = |from: usize, to: usize| {
            padded
                .get(from..to.min(padded.len()))
                .unwrap_or("")
                .trim()
                .to_string()
        };
        let name = cut(0, c_id);
        let id = cut(c_id, c_ver);
        let version = cut(c_ver, c_avail.min(padded.len()));
        let source = if c_src < padded.len() {
            padded[c_src..].trim().to_string()
        } else {
            String::new()
        };
        if name.is_empty() || id.is_empty() {
            continue;
        }
        out.push(InstalledApp {
            name,
            version,
            publisher: String::new(),
            source: if source.is_empty() {
                "winget".to_string()
            } else {
                source
            },
            winget_id: Some(id),
            uninstall_string: None,
            registry_key: None,
            install_location: None,
        });
    }
    out
}

/// Drops OS components, updates and hotfixes so the list shows real software.
fn is_noise(system_component: u32, parent_key: &str, parent_display: &str, release_type: &str) -> bool {
    if system_component == 1 || !parent_key.is_empty() || !parent_display.is_empty() {
        return true;
    }
    matches!(
        release_type.to_lowercase().as_str(),
        "security update" | "update" | "hotfix" | "service pack"
    )
}

#[cfg(target_os = "windows")]
fn registry_programs() -> Vec<InstalledApp> {
    use winreg::enums::*;
    use winreg::RegKey;
    let keys = [
        (
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            HKEY_LOCAL_MACHINE,
        ),
        (
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
            HKEY_LOCAL_MACHINE,
        ),
        (
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            HKEY_CURRENT_USER,
        ),
    ];
    let mut out = Vec::new();
    for (path, hive) in keys {
        let root = match RegKey::predef(hive).open_subkey(path) {
            Ok(k) => k,
            Err(_) => continue,
        };
        for name in root.enum_keys().filter_map(Result::ok) {
            let sub = match root.open_subkey(&name) {
                Ok(k) => k,
                Err(_) => continue,
            };
            let display: String = sub.get_value("DisplayName").unwrap_or_default();
            if display.trim().is_empty() {
                continue;
            }
            // Skip OS components, updates and parented entries.
            let system: u32 = sub.get_value("SystemComponent").unwrap_or(0);
            let parent: String = sub.get_value("ParentKeyName").unwrap_or_default();
            let parent_display: String =
                sub.get_value("ParentDisplayName").unwrap_or_default();
            let release: String = sub.get_value("ReleaseType").unwrap_or_default();
            if is_noise(system, &parent, &parent_display, &release) {
                continue;
            }
            let quiet: String = sub.get_value("QuietUninstallString").unwrap_or_default();
            let normal: String = sub.get_value("UninstallString").unwrap_or_default();
            let uninstall_string = if quiet.trim().is_empty() {
                normal.trim().to_string()
            } else {
                quiet.trim().to_string()
            };
            let hive_name = if hive == HKEY_LOCAL_MACHINE { "HKLM" } else { "HKCU" };
            out.push(InstalledApp {
                name: display,
                version: sub.get_value("DisplayVersion").unwrap_or_default(),
                publisher: sub.get_value("Publisher").unwrap_or_default(),
                source: "programs".to_string(),
                winget_id: None,
                uninstall_string: if uninstall_string.is_empty() {
                    None
                } else {
                    Some(uninstall_string)
                },
                registry_key: Some(format!("{hive_name}\\{path}\\{name}")),
                install_location: match sub.get_value::<String, _>("InstallLocation") {
                    Ok(loc) if !loc.trim().is_empty() => Some(loc),
                    _ => None,
                },
            });
        }
    }
    out
}

#[cfg(not(target_os = "windows"))]
fn registry_programs() -> Vec<InstalledApp> {
    vec![]
}

fn excell(name: &str) -> bool {
    // Runtime/framework packages are noise, not user software.
    const NOISE: &[&str] = &[
        "VCLibs",
        ".NET.Native",
        "UI.Xaml",
        "WinAppRuntime",
        "WindowsAppRuntime",
        "StorePurchaseApp",
        "SecHealthUI",
        "LanguageExperiencePack",
        "WebMediaExtensions",
        "VP9VideoExtensions",
        "WebpImageExtension",
        "RawImageExtension",
        "MPEG2VideoExtension",
        "HEIFImageExtension",
        "HEVCVideoExtension",
        "AV1VideoExtension",
        "AVCEncoderVideoExtension",
    ];
    NOISE.iter().any(|n| name.contains(n))
}

async fn store_packages() -> Vec<InstalledApp> {
    use crate::engine::no_window;
    let mut cmd = tokio::process::Command::new("powershell");
    no_window(&mut cmd);
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-AppxPackage | ForEach-Object { $_.Name + '|' + $_.Version }",
    ]);
    let out = match tokio::time::timeout(
        std::time::Duration::from_secs(60),
        cmd.output(),
    )
    .await
    {
        Ok(Ok(o)) if o.status.success() => o,
        _ => return vec![],
    };
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter_map(|l| {
            let (name, ver) = l.split_once('|')?;
            let name = name.trim();
            if name.is_empty() || excell(name) {
                return None;
            }
            Some(InstalledApp {
                name: name.to_string(),
                version: ver.trim().to_string(),
                publisher: String::new(),
                source: "store".to_string(),
                winget_id: None,
                uninstall_string: None,
                registry_key: None,
                install_location: None,
            })
        })
        .collect()
}

async fn winget_inventory() -> Vec<InstalledApp> {
    use crate::engine::{no_window, resolve_winget};
    let mut cmd = tokio::process::Command::new(resolve_winget());
    no_window(&mut cmd);
    cmd.args(["list", "--accept-source-agreements"]);
    let out = match tokio::time::timeout(
        std::time::Duration::from_secs(120),
        cmd.output(),
    )
    .await
    {
        Ok(Ok(o)) if o.status.success() => o,
        _ => return vec![],
    };
    parse_winget_table(&String::from_utf8_lossy(&out.stdout))
}

/// Full PC scan: winget + Programs registry + Store packages, deduplicated
/// (winget entry wins — it carries the exact id).
#[tauri::command]
pub async fn scan_installed() -> Result<InventoryReport, String> {
    let (winget, store) = tokio::join!(winget_inventory(), store_packages());
    let registry = registry_programs();
    let mut seen: HashSet<String> = HashSet::new();
    let mut apps: Vec<InstalledApp> = Vec::new();
    let mut key_of = HashMap::<String, usize>::new();
    for app in winget.into_iter().chain(registry).chain(store) {
        let key = app.name.to_lowercase();
        if let Some(&idx) = key_of.get(&key) {
            // Prefer entries that carry a winget id / publisher info.
            let cur_better = app.winget_id.is_some() && apps[idx].winget_id.is_none();
            if cur_better {
                apps[idx] = app;
            }
            continue;
        }
        if seen.insert(key.clone()) {
            key_of.insert(key, apps.len());
            apps.push(app);
        }
    }
    apps.sort_by_key(|a| a.name.to_lowercase());
    let winget_ids: Vec<String> = apps
        .iter()
        .filter_map(|a| a.winget_id.clone())
        .collect();
    let total = apps.len();
    Ok(InventoryReport {
        apps,
        winget_ids,
        total,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "\
Name                              Id                                      Version            Available       Source
------------------------------------------------------------------------------------------------------------------
7-Zip 26.00 (x64)                 7zip.7zip                               26.00              26.04           winget
App Installer                     Microsoft.AppInstaller                  1.29.379.0         1.29.380        winget
Dota 2                            ARP\\Machine\\X64\\Steam App 570           Unknown                            \n\
Mozilla Firefox (x64 ru)          ARP\\Machine\\X64\\Mozilla Firefox         157.0.1                            \n\
";

    #[test]
    fn parses_positions_not_spaces() {
        let apps = parse_winget_table(SAMPLE);
        assert_eq!(apps.len(), 4);
        assert_eq!(apps[0].name, "7-Zip 26.00 (x64)");
        assert_eq!(apps[0].winget_id.as_deref(), Some("7zip.7zip"));
        assert_eq!(apps[0].version, "26.00");
        assert_eq!(apps[2].name, "Dota 2");
        assert_eq!(apps[2].version, "Unknown");
        assert_eq!(apps[3].name, "Mozilla Firefox (x64 ru)");
    }

    #[test]
    fn empty_or_garbage_yields_nothing() {
        assert!(parse_winget_table("").is_empty());
        assert!(parse_winget_table("No installed package found.\n").is_empty());
    }

    #[test]
    fn noise_filter_keeps_real_apps() {
        assert!(!is_noise(0, "", "", ""));
        assert!(!is_noise(0, "", "", "Application"));
        assert!(is_noise(1, "", "", ""));
        assert!(is_noise(0, "{GUID}", "", ""));
        assert!(is_noise(0, "", "Something Suite", ""));
        assert!(is_noise(0, "", "", "Security Update"));
        assert!(is_noise(0, "", "", "Hotfix"));
    }
}
