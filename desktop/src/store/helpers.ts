import { api, type CatalogApp, type Settings, type SlimItem } from "../lib/api";
import type { Lang } from "../types";

export function byId(apps: CatalogApp[]): Map<string, CatalogApp> {
  const m = new Map<string, CatalogApp>();
  for (const a of apps) m.set(a.id, a);
  return m;
}

export function slim(a: CatalogApp): SlimItem {
  return {
    id: a.id,
    nameEn: a.nameEn,
    nameRu: a.nameRu,
    wingetId: a.wingetId,
    scoopName: a.scoopName,
    preferredEngine: a.preferredEngine,
  };
}

export function toSettings(
  lang: Lang,
  theme: string,
  accent: string,
  selected: Record<string, true>,
): Settings {
  return {
    Lang: lang,
    Theme: theme,
    Accent: accent,
    SelectedIds: Object.keys(selected),
    ProfileEdits: {},
  };
}

export async function persist(
  lang: Lang,
  theme: string,
  accent: string,
  selected: Record<string, true>,
): Promise<void> {
  try {
    await api.saveSettings(toSettings(lang, theme, accent, selected));
  } catch {
    /* settings must never crash the app */
  }
}

export function applyTheme(theme: string): void {
  const root = document.documentElement;
  const dark =
    theme === "dark" ||
    (theme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}
