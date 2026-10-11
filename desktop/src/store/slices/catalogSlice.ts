import { api, type CustomProfile, type Settings } from "../../lib/api";
import { applyAccent, type AccentId } from "../../types";
import { byId, persist } from "../helpers";
import type { Slice } from "../types";

export interface CatalogSliceState {
  booted: boolean;
}

function syncProfiles(profiles: CustomProfile[]): void {
  api.saveCustomProfiles(profiles).catch((e: unknown) => {
    console.error("profiles save failed", e);
  });
}

export const createCatalogSlice: Slice<import("../types").CatalogSlice> = (
  set,
  get,
) => ({
  booted: false,
  apps: [],
  selected: {},
  search: "",
  installed: {},
  scan: null,
  scanning: false,
  catalogUpdatedAt: null,
  customProfiles: [],

  boot: async () => {
    if (get().booted) return;
    const [catalog, settings, engines, admin, meta, custom] = await Promise.all([
      api.loadCatalog(),
      api.getSettings().catch(
        (): Settings => ({
          Lang: "ru",
          Theme: "system",
          Accent: "blue",
          SelectedIds: [],
          ProfileEdits: {},
          CustomProfiles: [],
        }),
      ),
      api.checkEngines().catch(() => ({ winget: false, scoop: false })),
      api.isAdmin().catch(() => false),
      api.catalogMeta().catch(() => null),
      api.getCustomProfiles().catch(() => [] as CustomProfile[]),
    ]);
    const lang = settings.Lang === "en" ? "en" : "ru";
    const accent: AccentId =
      settings.Accent === "violet" || settings.Accent === "teal"
        ? settings.Accent
        : "blue";
    const known = byId(catalog.apps);
    const selected: Record<string, true> = {};
    for (const id of settings.SelectedIds) if (known.has(id)) selected[id] = true;
    const customProfiles = (custom ?? settings.CustomProfiles ?? []).filter(
      (p) => p.Id && p.Name,
    );
    applyAccent(accent);
    set({
      booted: true,
      lang,
      theme: settings.Theme || "system",
      accent,
      apps: catalog.apps,
      selected,
      engines,
      needsAdmin: !admin,
      catalogUpdatedAt: meta?.updatedAt ?? null,
      customProfiles,
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

  applyCustomProfile: (profileId) => {
    const { apps, customProfiles } = get();
    const profile = customProfiles.find((p) => p.Id === profileId);
    if (!profile) return;
    const known = byId(apps);
    const selected: Record<string, true> = {};
    for (const id of profile.AppIds) if (known.has(id)) selected[id] = true;
    set({ selected });
    const { lang, theme, accent } = get();
    void persist(lang, theme, accent, selected);
  },

  createProfile: (name) => {
    const clean = name.trim().slice(0, 64);
    if (!clean) return;
    const ids = Object.keys(get().selected);
    if (ids.length === 0) return;
    const profile: CustomProfile = {
      Id: `cfg-${Date.now().toString(36)}`,
      Name: clean,
      AppIds: [...ids].sort(),
    };
    const customProfiles = [...get().customProfiles, profile];
    set({ customProfiles });
    syncProfiles(customProfiles);
  },

  renameProfile: (profileId, name) => {
    const clean = name.trim().slice(0, 64);
    if (!clean) return;
    const customProfiles = get().customProfiles.map((p) =>
      p.Id === profileId ? { ...p, Name: clean } : p,
    );
    set({ customProfiles });
    syncProfiles(customProfiles);
  },

  overwriteProfile: (profileId) => {
    const ids = Object.keys(get().selected);
    if (ids.length === 0) return;
    const customProfiles = get().customProfiles.map((p) =>
      p.Id === profileId ? { ...p, AppIds: [...ids].sort() } : p,
    );
    set({ customProfiles });
    syncProfiles(customProfiles);
  },

  deleteProfile: (profileId) => {
    const customProfiles = get().customProfiles.filter((p) => p.Id !== profileId);
    set({ customProfiles });
    syncProfiles(customProfiles);
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
