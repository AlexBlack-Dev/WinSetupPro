import type { StateCreator } from "zustand";
import type {
  AccentId,
  Job,
  Lang,
  Tab,
  ThemeId,
  Toast,
} from "../types";
import type {
  CatalogApp,
  InstallEvt,
  InstalledApp,
  Profile,
  ScanReport,
  SlimItem,
  UpdateInfo,
} from "../lib/api";

export type { CatalogApp, InstallEvt, InstalledApp, Profile, ScanReport, SlimItem, UpdateInfo };

export interface CatalogSlice {
  booted: boolean;
  apps: CatalogApp[];
  profiles: Profile[];
  selected: Record<string, true>;
  search: string;
  /** appId -> true/false once checked; absent = unknown yet. */
  installed: Record<string, boolean>;
  /** Full PC inventory (winget + programs + store). Null until first scan. */
  scan: ScanReport | null;
  scanning: boolean;
  /** mtime of the loaded catalog.json (unix seconds). Null until boot. */
  catalogUpdatedAt: number | null;
  boot: () => Promise<void>;
  toggle: (id: string) => void;
  applyProfile: (profileId: string) => void;
  clearSelection: () => void;
  setSearch: (q: string) => void;
  refreshInstalled: () => void;
  scanSystem: () => Promise<void>;
}

export interface QueueSlice {
  jobs: Job[];
  log: string[];
  overall: number;
  running: boolean;
  lastSynced: string[] | null;
  syncQueue: (force?: boolean) => void;
  runAll: () => Promise<void>;
  cancel: () => Promise<void>;
  removeJob: (id: string) => void;
  clearFinished: () => void;
  handleEvent: (e: InstallEvt) => void;
}

export interface SettingsSlice {
  lang: Lang;
  theme: string;
  accent: AccentId;
  engines: { winget: boolean; scoop: boolean };
  needsAdmin: boolean;
  statusLine: string;
  update: UpdateInfo | null;
  checkingUpdate: boolean;
  setLang: (l: Lang) => void;
  setTheme: (t: string) => void;
  setAccent: (a: AccentId) => void;
  refreshEngines: () => Promise<void>;
  installScoop: () => Promise<void>;
  doRestorePoint: () => Promise<void>;
  exportPreset: () => Promise<void>;
  importPreset: () => Promise<void>;
  checkUpdates: () => Promise<void>;
  setStatus: (s: string) => void;
}

export interface UiSlice {
  tab: Tab;
  setTab: (t: Tab) => void;
  toasts: Toast[];
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
}

export type Store = CatalogSlice & QueueSlice & SettingsSlice & UiSlice;
export type Slice<T> = StateCreator<Store, [], [], T>;

export type { Job, Lang, Tab, ThemeId, Toast };
