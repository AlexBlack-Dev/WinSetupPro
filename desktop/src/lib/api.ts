import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type EngineKind = "Winget" | "Scoop";
export type Category =
  | "Essential" | "Browser" | "DevCore" | "Frontend" | "Backend"
  | "PythonAi" | "Gamedev" | "Design3D" | "Office" | "Media"
  | "Gaming" | "Network" | "Utilities" | "Runtime";

export interface CatalogApp {
  id: string;
  nameEn: string;
  nameRu: string;
  descriptionEn: string;
  descriptionRu: string;
  wingetId: string | null;
  scoopName: string | null;
  preferredEngine: EngineKind;
  category: Category;
  profiles: string[];
  isPopular: boolean;
  iconGlyph: string;
  icon: string | null;
  icon_svg?: string | null;
  icon_png?: string | null;
}

export interface Profile {
  id: string;
  nameEn: string;
  nameRu: string;
  iconGlyph: string;
  appIds: string[];
}

export interface CatalogData {
  apps: CatalogApp[];
  profiles: Profile[];
}

export interface ProfileEdit {
  Added: string[];
  Removed: string[];
}

export interface Settings {
  Lang: string;
  Theme: string;
  Accent: string;
  SelectedIds: string[];
  ProfileEdits: Record<string, ProfileEdit>;
}

export type JobStatus =
  | "queued" | "running" | "succeeded" | "failed" | "skipped" | "cancelled";

export type InstallEvt =
  | { type: "log"; item: string; message: string; kind: string }
  | { type: "status"; item: string; status: JobStatus; progress: number }
  | { type: "overall"; done: number; total: number }
  | { type: "finished" };

export interface SlimItem {
  id: string;
  nameEn: string;
  nameRu: string;
  wingetId: string | null;
  scoopName: string | null;
  preferredEngine: EngineKind;
}

export interface InstalledApp {
  name: string;
  version: string;
  publisher: string;
  source: string;
  wingetId: string | null;
}

export interface ScanReport {
  apps: InstalledApp[];
  wingetIds: string[];
  total: number;
}

export const api = {
  loadCatalog: () => invoke<CatalogData>("load_catalog"),
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (settings: Settings) => invoke("save_settings", { settings }),
  checkEngines: () => invoke<{ winget: boolean; scoop: boolean }>("check_engines"),
  checkInstalled: (engine: EngineKind, id: string) =>
    invoke<boolean>("check_installed", { engine, id }),
  startInstall: (items: SlimItem[]) => invoke("start_install", { items }),
  cancelInstall: () => invoke("cancel_install"),
  createRestorePoint: () => invoke<boolean>("create_restore_point"),
  isAdmin: () => invoke<boolean>("is_admin"),
  restartAsAdmin: () => invoke("restart_as_admin"),
  installScoop: () => invoke<string>("install_scoop"),
  exportPreset: (path: string, ids: string[]) =>
    invoke("export_preset", { path, ids }),
  importPreset: (path: string) => invoke<string[]>("import_preset", { path }),
  scanInstalled: () => invoke<ScanReport>("scan_installed"),
  onInstallEvent: (cb: (e: InstallEvt) => void): Promise<UnlistenFn> =>
    listen<InstallEvt>("install-event", (ev) => cb(ev.payload)),
};
