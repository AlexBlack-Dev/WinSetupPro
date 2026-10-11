use crate::model::{AppPayload, CatalogPayload, SoftwareItem, SoftwareProfile};
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(serde::Deserialize)]
struct CatalogRoot {
    #[serde(default)]
    apps: Vec<SoftwareItem>,
    #[serde(default)]
    profiles: Vec<SoftwareProfile>,
}

pub fn data_dir() -> PathBuf {
    std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("WinSetupPro")
}

/// Resolution order: user override → (dev: repo tree) → bundled resources.
/// NOTE: in dev the repo tree MUST come before the bundle: tauri-build's
/// resource sync does not reliably pick up newly added files (icons kept
/// going stale in target/debug/_up_ while the repo had them).
fn candidates(handle: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut v = vec![data_dir().join("catalog.json")];
    #[cfg(debug_assertions)]
    v.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../catalog/catalog.json"));
    if let Ok(res) = handle.path().resource_dir() {
        v.push(res.join("_up_/_up_/catalog/catalog.json"));
        v.push(res.join("catalog/catalog.json"));
    }
    #[cfg(not(debug_assertions))]
    v.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../catalog/catalog.json"));
    v
}

fn icons_dir_for(catalog_file: &Path, handle: &tauri::AppHandle) -> PathBuf {
    // Override catalog → override icons next to settings; bundled → sibling icons/.
    if catalog_file.starts_with(data_dir()) {
        return data_dir().join("icons");
    }
    if let Some(parent) = catalog_file.parent() {
        let sib = parent.join("icons");
        if sib.is_dir() {
            return sib;
        }
    }
    if let Ok(res) = handle.path().resource_dir() {
        let p = res.join("_up_/_up_/catalog/icons");
        if p.is_dir() {
            return p;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../catalog/icons")
}

/// Resolves one catalog icon to its payload: SVG stays text, raster becomes base64.
fn inline_icon(icons_dir: &Path, rel: &str) -> (Option<String>, Option<String>) {
    let none = || (None, None);
    let name = match Path::new(rel).file_name().and_then(|n| n.to_str()) {
        Some(n) => n,
        None => return none(),
    };
    if name.len() > 128 || name.contains("..") || name.contains('/') || name.contains('\\') {
        return none();
    }
    let full = icons_dir.join(name);
    if !full.is_file() {
        return none();
    }
    let is_svg = full
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("svg"))
        .unwrap_or(false);
    if is_svg {
        let text = match std::fs::read_to_string(&full) {
            Ok(t) => t,
            Err(_) => return none(),
        };
        if text.len() > 100_000 {
            return none();
        }
        let Some(start) = text.find("<svg") else {
            return none();
        };
        let raw = &text[start..];
        if raw.len() > 100_000 {
            return none();
        }
        return match sanitize_svg(raw) {
            Some(clean) => (Some(clean), None),
            None => none(),
        };
    }
    let bytes = match std::fs::read(&full) {
        Ok(b) if b.len() >= 200 => b,
        _ => return none(),
    };
    {
        use base64::Engine as _;
        let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
        (None, Some(b64))
    }
}

#[tauri::command]
pub fn load_catalog(handle: tauri::AppHandle) -> Result<CatalogPayload, String> {
    let mut last_err = "catalog.json not found (override, resources, or repo tree)".to_string();
    for file in candidates(&handle) {
        if !file.is_file() {
            continue;
        }
        match try_load_one(&handle, &file) {
            Ok(payload) => return Ok(payload),
            Err(e) => {
                last_err = format!("{}: {e}", file.display());
            }
        }
    }
    Err(last_err)
}

fn try_load_one(handle: &tauri::AppHandle, file: &Path) -> Result<CatalogPayload, String> {    let meta = std::fs::metadata(file).map_err(|e| format!("stat catalog: {e}"))?;
    if meta.len() > 5_000_000 {
        return Err("catalog too large (>5MB)".to_string());
    }
    let text = std::fs::read_to_string(file).map_err(|e| format!("read catalog: {e}"))?;
    let mut root: CatalogRoot =
        serde_json::from_str(&text).map_err(|e| format!("parse catalog: {e}"))?;
    validate_catalog(&mut root)?;
    let icons = icons_dir_for(file, handle);
    let apps = root
        .apps
        .into_iter()
        .map(|item| {
            let (icon_svg, icon_png) = item
                .icon
                .as_deref()
                .map(|rel| inline_icon(&icons, rel))
                .unwrap_or((None, None));
            AppPayload {
                item,
                icon_svg,
                icon_png,
            }
        })
        .collect();
    Ok(CatalogPayload {
        apps,
        profiles: root.profiles,
    })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogMeta {
    pub apps: usize,
    pub profiles: usize,
    pub updated_at: u64,
}

/// Lightweight freshness probe: counts + file mtime, no icon inlining.
#[tauri::command]
pub fn catalog_meta(handle: tauri::AppHandle) -> Result<CatalogMeta, String> {
    let mut last_err = "catalog.json not found".to_string();
    for file in candidates(&handle) {
        if !file.is_file() {
            continue;
        }
        let meta = std::fs::metadata(&file).map_err(|e| format!("stat catalog: {e}"))?;
        if meta.len() > 5_000_000 {
            last_err = "catalog too large".to_string();
            continue;
        }
        let updated_at = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let text = std::fs::read_to_string(&file).map_err(|e| format!("read catalog: {e}"))?;
        let mut root: CatalogRoot =
            serde_json::from_str(&text).map_err(|e| format!("parse catalog: {e}"))?;
        if let Err(e) = validate_catalog(&mut root) {
            last_err = e;
            continue;
        }
        return Ok(CatalogMeta {
            apps: root.apps.len(),
            profiles: root.profiles.len(),
            updated_at,
        });
    }
    Err(last_err)
}

fn is_valid_app_id(id: &str) -> bool {
    if id.is_empty() || id.len() > 64 {
        return false;
    }
    id.chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

fn is_valid_engine_ref(s: &str) -> bool {
    if s.is_empty() || s.len() > 128 {
        return false;
    }
    s.chars().all(|c| {
        c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' || c == '+'
    })
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

fn validate_catalog(root: &mut CatalogRoot) -> Result<(), String> {
    if root.apps.is_empty() {
        return Err("catalog has no apps".to_string());
    }
    if root.apps.len() > 5000 {
        return Err("catalog too many apps".to_string());
    }
    if root.profiles.len() > 200 {
        return Err("catalog too many profiles".to_string());
    }
    for a in &mut root.apps {
        if !is_valid_app_id(&a.id) {
            return Err(format!("bad app id: {}", a.id));
        }
        if let Some(w) = &a.winget_id {
            if !is_valid_engine_ref(w) {
                return Err(format!("bad winget_id for {}: {w}", a.id));
            }
        }
        if let Some(s) = &a.scoop_name {
            if !is_valid_engine_ref(s) {
                return Err(format!("bad scoop_name for {}: {s}", a.id));
            }
        }
        if a.winget_id.is_none() && a.scoop_name.is_none() {
            return Err(format!("no engine for {}", a.id));
        }
        truncate(&mut a.name_en, 120);
        truncate(&mut a.name_ru, 120);
        truncate(&mut a.description_en, 2000);
        truncate(&mut a.description_ru, 2000);
        if let Some(icon) = &mut a.icon {
            truncate(icon, 160);
        }
        if a.profiles.len() > 32 {
            a.profiles.truncate(32);
        }
    }
    for p in &mut root.profiles {
        if !is_valid_app_id(&p.id) {
            return Err(format!("bad profile id: {}", p.id));
        }
        if p.app_ids.len() > 2000 {
            return Err(format!("profile {} too large", p.id));
        }
        for id in &p.app_ids {
            if !is_valid_app_id(id) {
                return Err(format!("bad app ref {id} in profile {}", p.id));
            }
        }
    }
    Ok(())
}

fn sanitize_svg(raw: &str) -> Option<String> {
    let lower = raw.to_ascii_lowercase();
    for bad in [
        "<script",
        "<iframe",
        "<object",
        "<embed",
        "<foreignobject",
        "<meta",
        "<link",
        "javascript:",
        "vbscript:",
        "data:text/html",
    ] {
        if lower.contains(bad) {
            return None;
        }
    }
    let mut out = String::with_capacity(raw.len());
    let bytes = raw.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'o' || bytes[i] == b'O' {
            let prev_ok = i == 0
                || bytes[i - 1] == b' '
                || bytes[i - 1] == b'\t'
                || bytes[i - 1] == b'\n'
                || bytes[i - 1] == b'\r';
            if prev_ok && i + 2 < bytes.len() && (bytes[i + 1] == b'n' || bytes[i + 1] == b'N') {
                let mut j = i + 2;
                while j < bytes.len() && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b'-' || bytes[j] == b'_') {
                    j += 1;
                }
                let mut k = j;
                while k < bytes.len() && (bytes[k] == b' ' || bytes[k] == b'\t' || bytes[k] == b'\n' || bytes[k] == b'\r') {
                    k += 1;
                }
                if k < bytes.len() && bytes[k] == b'=' {
                    while j < bytes.len() {
                        let c = bytes[j];
                        if c == b'"' || c == b'\'' {
                            let q = c;
                            j += 1;
                            while j < bytes.len() && bytes[j] != q {
                                j += 1;
                            }
                            if j < bytes.len() {
                                j += 1;
                            }
                            break;
                        } else if c == b' ' || c == b'\t' || c == b'\n' || c == b'\r' || c == b'>' || c == b'/' {
                            break;
                        }
                        j += 1;
                    }
                    i = j;
                    continue;
                }
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    if !out.starts_with("<svg") {
        return None;
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn repo_catalog() -> CatalogRoot {
        let path =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../catalog/catalog.json");
        let text = std::fs::read_to_string(&path).expect("repo catalog.json must exist");
        serde_json::from_str(&text).expect("catalog must parse")
    }

    #[test]
    fn catalog_has_substantial_size() {
        let c = repo_catalog();
        assert!(c.apps.len() >= 100, "apps: {}", c.apps.len());
        assert!(c.profiles.len() >= 6, "profiles: {}", c.profiles.len());
    }

    #[test]
    fn no_duplicate_ids() {
        let c = repo_catalog();
        let mut seen = HashSet::new();
        for a in &c.apps {
            assert!(seen.insert(a.id.to_lowercase()), "dupe: {}", a.id);
        }
    }

    #[test]
    fn every_app_has_an_engine() {
        let c = repo_catalog();
        let broken: Vec<_> = c
            .apps
            .iter()
            .filter(|a| a.winget_id.is_none() && a.scoop_name.is_none())
            .map(|a| a.id.clone())
            .collect();
        assert!(broken.is_empty(), "no engine: {broken:?}");
    }

    #[test]
    fn every_profile_app_resolves() {
        let c = repo_catalog();
        let ids: HashSet<_> = c.apps.iter().map(|a| a.id.as_str()).collect();
        for p in &c.profiles {
            for id in &p.app_ids {
                assert!(ids.contains(id.as_str()), "profile {} → missing {id}", p.id);
            }
        }
    }

    #[test]
    fn inline_icon_resolves_svg_and_png() {
        let dir =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../catalog/icons");
        let (svg, png) = super::inline_icon(&dir, "icons/git.svg");
        assert!(svg.map(|s| s.starts_with("<svg")).unwrap_or(false));
        assert!(png.is_none());
        let (svg2, png2) = super::inline_icon(&dir, "icons/vcredist.png");
        assert!(svg2.is_none());
        let b64 = png2.expect("vcredist.png must inline as base64");
        assert!(b64.len() > 300, "payload too small: {}", b64.len());
        let raw = {
            use base64::Engine as _;
            base64::engine::general_purpose::STANDARD
                .decode(&b64)
                .expect("valid base64")
        };
        assert_eq!(
            &raw[..8],
            &[137, 80, 78, 71, 13, 10, 26, 10],
            "must decode to a PNG"
        );
    }

    #[test]
    fn svg_sanitizer_blocks_xss() {
        assert!(super::sanitize_svg("<svg><script>alert(1)</script></svg>").is_none());
        assert!(super::sanitize_svg("<svg><foreignObject><p>x</p></foreignObject></svg>").is_none());
        assert!(super::sanitize_svg("<svg><a href=\"javascript:alert(1)\">x</a></svg>").is_none());
        let clean = super::sanitize_svg("<svg onclick=\"alert(1)\" viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\"/></svg>")
            .expect("safe svg must pass");
        assert!(!clean.to_ascii_lowercase().contains("onclick"));
        assert!(clean.starts_with("<svg"));
    }

    #[test]
    fn validator_rejects_bad_ids() {
        assert!(!super::is_valid_app_id("Bad Id!"));
        assert!(!super::is_valid_app_id(""));
        assert!(super::is_valid_app_id("vscode"));
        assert!(!super::is_valid_engine_ref("id with spaces"));
        assert!(super::is_valid_engine_ref("7zip.7zip"));
    }

    #[test]
    fn versions_stay_in_sync() {
        let cargo = read_cargo_version();
        let tauri = repo_tauri_version();
        let npm = read_npm_version();
        assert_eq!(cargo, tauri, "Cargo.toml vs tauri.conf.json");
        assert_eq!(cargo, npm, "Cargo.toml vs package.json");
        assert_eq!(cargo, "0.2.0");
    }

    fn read_cargo_version() -> String {
        let text = std::fs::read_to_string(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml"),
        )
        .expect("Cargo.toml must exist");
        let mut in_package = false;
        for line in text.lines() {
            let t = line.trim();
            if t.starts_with('[') {
                in_package = t == "[package]";
                continue;
            }
            if in_package {
                if let Some(v) = t.strip_prefix("version") {
                    let v = v.trim().trim_start_matches('=').trim().trim_matches('"');
                    if !v.is_empty() {
                        return v.to_string();
                    }
                }
            }
        }
        panic!("version not found in Cargo.toml");
    }

    fn repo_tauri_version() -> String {
        let text = std::fs::read_to_string(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json"),
        )
        .expect("tauri.conf.json must exist");
        let v: serde_json::Value = serde_json::from_str(&text).expect("tauri json must parse");
        v.get("version")
            .and_then(|x| x.as_str())
            .expect("tauri version must exist")
            .to_string()
    }

    fn read_npm_version() -> String {
        let text = std::fs::read_to_string(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../package.json"),
        )
        .expect("package.json must exist");
        let v: serde_json::Value = serde_json::from_str(&text).expect("package.json must parse");
        v.get("version")
            .and_then(|x| x.as_str())
            .expect("npm version must exist")
            .to_string()
    }
}
