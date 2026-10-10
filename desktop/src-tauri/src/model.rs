use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EngineKind {
    Winget,
    Scoop,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SoftwareCategory {
    Essential,
    Browser,
    DevCore,
    Frontend,
    Backend,
    PythonAi,
    Gamedev,
    Design3D,
    Office,
    Media,
    Gaming,
    Network,
    Utilities,
    Runtime,
}

fn default_engine() -> EngineKind {
    EngineKind::Winget
}
fn default_category() -> SoftwareCategory {
    SoftwareCategory::Essential
}

/// Mirrors catalog/catalog.json (camelCase keys).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareItem {
    pub id: String,
    pub name_en: String,
    pub name_ru: String,
    #[serde(default)]
    pub description_en: String,
    #[serde(default)]
    pub description_ru: String,
    #[serde(default)]
    pub winget_id: Option<String>,
    #[serde(default)]
    pub scoop_name: Option<String>,
    #[serde(default = "default_engine")]
    pub preferred_engine: EngineKind,
    #[serde(default = "default_category")]
    pub category: SoftwareCategory,
    #[serde(default)]
    pub profiles: Vec<String>,
    #[serde(default)]
    pub is_popular: bool,
    #[serde(default)]
    pub icon_glyph: String,
    #[serde(default)]
    pub icon: Option<String>,
}

/// Catalog app + inlined icon (SVG text or base64 PNG, offline-friendly).
#[derive(Debug, Clone, Serialize)]
pub struct AppPayload {
    #[serde(flatten)]
    pub item: SoftwareItem,
    pub icon_svg: Option<String>,
    pub icon_png: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareProfile {
    pub id: String,
    pub name_en: String,
    pub name_ru: String,
    #[serde(default)]
    pub icon_glyph: String,
    #[serde(default)]
    pub app_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogPayload {
    pub apps: Vec<AppPayload>,
    pub profiles: Vec<SoftwareProfile>,
}

/// Slim install request from the frontend (no icon blobs over IPC).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallItem {
    pub id: String,
    #[serde(default)]
    pub name_en: String,
    #[serde(default)]
    pub name_ru: String,
    #[serde(default)]
    pub winget_id: Option<String>,
    #[serde(default)]
    pub scoop_name: Option<String>,
    #[serde(default = "default_engine")]
    pub preferred_engine: EngineKind,
}

/// Streamed to the frontend via `install-event`.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum InstallEvent {
    Log {
        item: String,
        message: String,
        kind: String,
    },
    Status {
        item: String,
        status: String,
        progress: f64,
    },
    Overall {
        done: usize,
        total: usize,
    },
    Finished,
}

/// Same shape as the .NET settings.json (PascalCase) — selections survive migration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ProfileEdit {
    #[serde(default)]
    pub added: Vec<String>,
    #[serde(default)]
    pub removed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct AppSettings {
    #[serde(default)]
    pub lang: String,
    #[serde(default)]
    pub theme: String,
    #[serde(default)]
    pub accent: String,
    #[serde(default)]
    pub selected_ids: Vec<String>,
    #[serde(default)]
    pub profile_edits: HashMap<String, ProfileEdit>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            lang: "ru".to_string(),
            theme: "system".to_string(),
            accent: "blue".to_string(),
            selected_ids: Vec::new(),
            profile_edits: HashMap::new(),
        }
    }
}

impl AppSettings {
    pub fn normalized(mut self) -> Self {
        if self.lang != "en" && self.lang != "ru" {
            self.lang = "ru".to_string();
        }
        match self.theme.as_str() {
            "dark" | "light" | "system" => {}
            _ => self.theme = "system".to_string(),
        }
        match self.accent.as_str() {
            "blue" | "violet" | "teal" => {}
            _ => self.accent = "blue".to_string(),
        }
        self.selected_ids.sort();
        self.selected_ids.dedup();
        self
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub winget: bool,
    pub scoop: bool,
}
