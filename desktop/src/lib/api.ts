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

export interface CustomProfile {
  Id: string;
  Name: string;
  AppIds: string[];
}

export interface Settings {
  Lang: string;
  Theme: string;
  Accent: string;
  SelectedIds: string[];
  ProfileEdits: Record<string, ProfileEdit>;
  CustomProfiles: CustomProfile[];
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
  uninstallString?: string | null;
  registryKey?: string | null;
  installLocation?: string | null;
}

export interface ScanReport {
  apps: InstalledApp[];
  wingetIds: string[];
  total: number;
}

export interface UninstallItem {
  id: string;
  displayName: string;
  wingetId: string | null;
  scoopName: string | null;
  uninstallString: string | null;
}

export interface LeftoverReport {
  registryKeys: string[];
  paths: string[];
}

export interface RemovedReport {
  removedRegistry: number;
  removedPaths: number;
  errors: string[];
}

export interface DiskInfo {
  name: string;
  totalGb: number;
  freeGb: number;
}

export interface SystemInfo {
  cpu: string;
  cores: number;
  ramTotalGb: number;
  ramFreeGb: number;
  os: string;
  uptimeHours: number;
  gpus: string[];
  disks: DiskInfo[];
}

export interface ProcInfo {
  name: string;
  pid: number;
  cpu: number;
  ramMb: number;
  company: string;
  path: string;
  suspicious: boolean;
  reason: string;
}

export interface StartupEntry {
  source: string;
  name: string;
  command: string;
  location: string;
}

export interface DefenderStatus {
  available: boolean;
  realtime: boolean;
  signaturesOk: boolean;
  detail: string;
}

export interface TempTarget {
  id: string;
  path: string;
  mb: number;
}

export interface CleanReport {
  removedFiles: number;
  freedMb: number;
  errors: string[];
}

export interface TweakInfo {
  id: string;
  needsAdmin: boolean;
}

export interface UpdateInfo {
  latest: string;
  notes: string;
  url: string;
  available: boolean;
}

export interface CatalogMeta {
  apps: number;
  profiles: number;
  updatedAt: number;
}

export interface StartupBackupMeta {
  file: string;
  name: string;
  location: string;
  deletedAt: string;
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
  getCustomProfiles: () => invoke<CustomProfile[]>("get_custom_profiles"),
  saveCustomProfiles: (profiles: CustomProfile[]) =>
    invoke("save_custom_profiles", { profiles }),
  scanInstalled: () => invoke<ScanReport>("scan_installed"),
  startUninstall: (items: UninstallItem[]) => invoke("start_uninstall", { items }),
  scanLeftovers: (displayName: string, publisher: string) =>
    invoke<LeftoverReport>("scan_leftovers", { displayName, publisher }),
  removeLeftovers: (registryKeys: string[], paths: string[]) =>
    invoke<RemovedReport>("remove_leftovers", { registryKeys, paths }),
  systemInfo: () => invoke<SystemInfo>("system_info"),
  listProcesses: () => invoke<ProcInfo[]>("list_processes"),
  killProcess: (pid: number) => invoke<string>("kill_process", { pid }),
  listStartup: () => invoke<StartupEntry[]>("list_startup"),
  disableStartup: (location: string, name: string) =>
    invoke("disable_startup", { location, name }),
  listStartupBackups: () => invoke<StartupBackupMeta[]>("list_startup_backups"),
  restoreStartupBackup: (file: string) => invoke("restore_startup_backup", { file }),
  defenderStatus: () => invoke<DefenderStatus>("defender_status"),
  diskTemps: () => invoke<TempTarget[]>("disk_temps"),
  cleanTemps: (ids: string[]) => invoke<CleanReport>("clean_temps", { ids }),
  listTweaks: () => invoke<TweakInfo[]>("list_tweaks"),
  tweakStatus: (id: string) => invoke<boolean>("tweak_status", { id }),
  applyTweak: (id: string) => invoke("apply_tweak", { id }),
  revertTweak: (id: string) => invoke("revert_tweak", { id }),
  checkUpdate: (current: string) => invoke<UpdateInfo>("check_update", { current }),
  openLogsDir: () => invoke<string>("open_logs_dir"),
  catalogMeta: () => invoke<CatalogMeta>("catalog_meta"),
  onInstallEvent: (cb: (e: InstallEvt) => void): Promise<UnlistenFn> =>
    listen<InstallEvt>("install-event", (ev) => cb(ev.payload)),
};
