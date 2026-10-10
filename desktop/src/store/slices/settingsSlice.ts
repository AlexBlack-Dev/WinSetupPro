import { api } from "../../lib/api";
import { ACCENTS, applyAccent, type AccentId, type Lang } from "../../types";
import { translations } from "../../i18n/translations";
import { byId, persist } from "../helpers";
import type { Slice } from "../types";

export const createSettingsSlice: Slice<import("../types").SettingsSlice> = (
  set,
  get,
) => ({
  lang: "ru",
  theme: "system",
  accent: "blue",
  engines: { winget: false, scoop: false },
  needsAdmin: false,
  statusLine: "",

  setLang: (lang: Lang) => {
    set({ lang });
    const { theme, accent, selected } = get();
    void persist(lang, theme, accent, selected);
  },

  setTheme: (theme: string) => {
    set({ theme });
    const { lang, accent, selected } = get();
    void persist(lang, theme, accent, selected);
  },

  setAccent: (accent: AccentId) => {
    set({ accent });
    applyAccent(accent);
    const { lang, theme, selected } = get();
    void persist(lang, theme, accent, selected);
    get().toast(
      `${translations[lang].accent}: ${ACCENTS[accent].label}`,
      "info",
    );
  },

  refreshEngines: async () => {
    try {
      set({ engines: await api.checkEngines() });
    } catch (e) {
      console.error("engines check failed", e);
    }
  },

  installScoop: async () => {
    set({ statusLine: "scoop…" });
    try {
      await api.installScoop();
      set({ statusLine: "ok" });
      get().toast("Scoop ok", "ok");
    } catch (e) {
      const msg = String(e);
      set({ statusLine: msg });
      get().toast(msg, "err");
    }
    await get().refreshEngines();
  },

  doRestorePoint: async () => {
    const ok = await api.createRestorePoint().catch((e: unknown) => {
      console.error("restore point failed", e);
      return false;
    });
    set({ statusLine: ok ? "restore-ok" : "restore-fail" });
    get().toast(ok ? "restore-ok" : "restore-fail", ok ? "ok" : "err");
  },

  exportPreset: async () => {
    const { openDialogSave } = await import("../../lib/dialog");
    const path = await openDialogSave();
    if (!path) return;
    const ids = Object.keys(get().selected);
    try {
      await api.exportPreset(path, ids);
      set({ statusLine: path });
    } catch (e) {
      const msg = String(e);
      console.error("export failed", e);
      set({ statusLine: msg });
      get().toast(msg, "err");
    }
  },

  importPreset: async () => {
    const { openDialogOpen } = await import("../../lib/dialog");
    const path = await openDialogOpen();
    if (!path) return;
    try {
      const ids = await api.importPreset(path);
      const known = byId(get().apps);
      const selected: Record<string, true> = {};
      for (const id of ids) if (known.has(id)) selected[id] = true;
      set({ selected, statusLine: path });
      const { lang, theme, accent } = get();
      void persist(lang, theme, accent, selected);
    } catch (e) {
      const msg = String(e);
      console.error("import failed", e);
      set({ statusLine: msg });
      get().toast(msg, "err");
    }
  },

  setStatus: (statusLine: string) => set({ statusLine }),
});
