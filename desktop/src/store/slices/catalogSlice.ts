import { api, type Settings } from "../../lib/api";
import { applyAccent, type AccentId } from "../../types";
import { byId, persist } from "../helpers";
import type { Slice } from "../types";

export interface CatalogSliceState {
  booted: boolean;
}

export const createCatalogSlice: Slice<import("../types").CatalogSlice> = (
  set,
  get,
) => ({
  booted: false,
  apps: [],
  profiles: [],
  selected: {},
  search: "",
  installed: {},
  scan: null,
  scanning: false,

  boot: async () => {
    if (get().booted) return;
    const [catalog, settings, engines, admin] = await Promise.all([
      api.loadCatalog(),
      api.getSettings().catch(
        (): Settings => ({
          Lang: "ru",
          Theme: "system",
          Accent: "blue",
          SelectedIds: [],
          ProfileEdits: {},
        }),
      ),
      api.checkEngines().catch(() => ({ winget: false, scoop: false })),
      api.isAdmin().catch(() => false),
    ]);
    const lang = settings.Lang === "en" ? "en" : "ru";
    const accent: AccentId =
      settings.Accent === "violet" || settings.Accent === "teal"
        ? settings.Accent
        : "blue";
    const known = byId(catalog.apps);
    const selected: Record<string, true> = {};
    for (const id of settings.SelectedIds) if (known.has(id)) selected[id] = true;
    applyAccent(accent);
    set({
      booted: true,
      lang,
      theme: settings.Theme || "system",
      accent,
      apps: catalog.apps,
      profiles: catalog.profiles,
      selected,
      engines,
      needsAdmin: !admin,
    });
    get().refreshInstalled();
  },

  toggle: (id) => {
    const selected = { ...get().selected };
    if (selected[id]) delete selected[id];
    else selected[id] = true;
    set({ selected });
    const { lang, theme, accent } = get();
    void persist(lang, theme, accent, selected);
  },

  applyProfile: (profileId) => {
    const { apps, profiles } = get();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    const known = byId(apps);
    const selected: Record<string, true> = {};
    for (const id of profile.appIds) if (known.has(id)) selected[id] = true;
    set({ selected });
    const { lang, theme, accent } = get();
    void persist(lang, theme, accent, selected);
  },

  clearSelection: () => {
    set({ selected: {} });
    const { lang, theme, accent } = get();
    void persist(lang, theme, accent, {});
  },

  setSearch: (search) => set({ search }),

  /**
   * Background sweep: marks installed apps (green badge) progressively.
   * Capped concurrency, errors mean "unknown" (no badge) — never blocks UI.
   */
  scanSystem: async () => {
    if (get().scanning) return;
    set({ scanning: true });
    try {
      const scan = await api.scanInstalled();
      set({ scan, scanning: false });
    } catch (e) {
      console.error("system scan failed", e);
      set({ scanning: false });
      throw e;
    }
  },

  refreshInstalled: () => {
    const run = async () => {
      const st = get();
      if (!st.scan) {
        try {
          await st.scanSystem();
        } catch {
          return;
        }
      }
      const { apps, scan } = get();
      const wingetSet = new Set(
        (scan?.wingetIds ?? []).map((s) => s.toLowerCase()),
      );
      const next: Record<string, boolean> = {};
      const scoopApps = [];
      for (const a of apps) {
        if (a.wingetId) {
          next[a.id] = wingetSet.has(a.wingetId.toLowerCase());
        } else if (a.scoopName) {
          scoopApps.push(a);
        }
      }
      set({ installed: next });
      const queue = [...scoopApps];
      const workers = Array.from({ length: 2 }, async () => {
        while (queue.length > 0) {
          const app = queue.shift();
          if (!app) return;
          try {
            const ok = await api.checkInstalled("Scoop", app.scoopName!);
            set((s) => ({ installed: { ...s.installed, [app.id]: ok } }));
          } catch (e) {
            console.error("install check failed", app.id, e);
          }
        }
      });
      await Promise.all(workers);
    };
    void run();
  },
});
