import type {
  CatalogApp,
  Category,
  EngineKind,
  JobStatus,
  Profile,
} from "../lib/api";

export type { CatalogApp, Category, EngineKind, JobStatus, Profile };
export type Lang = "ru" | "en";
export type AccentId = "blue" | "violet" | "teal";
export type ThemeId = "system" | "dark" | "light";
export type Tab = "catalog" | "queue" | "settings" | "installed";

export interface Job {
  id: string;
  name: string;
  app: CatalogApp;
  status: JobStatus;
  logTail: string;
  progress: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: "ok" | "err" | "info";
}

/** Brand accents: blue default (our cube), violet (Spire nod), deep teal. */
export const ACCENTS: Record<AccentId, { bg: string; hover: string; label: string }> = {
  blue: { bg: "#2563eb", hover: "#1d4ed8", label: "Blue" },
  violet: { bg: "#7c6af7", hover: "#8f7fff", label: "Violet" },
  teal: { bg: "#0f766e", hover: "#115e59", label: "Teal" },
};

export function applyAccent(id: AccentId): void {
  const a = ACCENTS[id] ?? ACCENTS.blue;
  const root = document.documentElement;
  root.style.setProperty("--accent", a.bg);
  root.style.setProperty("--accent-hover", a.hover);
}
