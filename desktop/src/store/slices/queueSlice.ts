import { api, type CatalogApp, type JobStatus } from "../../lib/api";
import type { Job } from "../../types";
import { byId, slim } from "../helpers";
import type { Slice } from "../types";

export const createQueueSlice: Slice<import("../types").QueueSlice> = (
  set,
  get,
) => ({
  jobs: [],
  log: [],
  overall: 0,
  running: false,
  lastSynced: null as string[] | null,

  syncQueue: (force = false) => {
    const { apps, selected, jobs, lastSynced } = get();
    const known = byId(apps);
    const ids = Object.keys(selected).filter((id) => known.has(id));
    const same =
      lastSynced !== null &&
      lastSynced.length === ids.length &&
      lastSynced.every((id) => selected[id]);
    if (!force && same && jobs.length > 0) return;
    const lang = get().lang;
    set({
      jobs: ids.map((id) => {
        const app = known.get(id)!;
        return {
          id,
          name: lang === "ru" ? app.nameRu : app.nameEn,
          app,
          status: "queued" as JobStatus,
          logTail: "",
          progress: 0,
        };
      }),
      log: [],
      overall: 0,
      lastSynced: ids,
    });
  },

  runAll: async () => {
    const { jobs, running } = get();
    if (running || jobs.length === 0) return;
    set({ running: true, log: [] });
    try {
      const { apps } = get();
      const known = byId(apps);
      const items = jobs
        .map((j) => known.get(j.id))
        .filter((a): a is CatalogApp => !!a)
        .map(slim);
      await api.startInstall(items);
    } catch (e) {
      set((s) => ({
        running: false,
        log: [...s.log, `ERR: ${String(e)}`].slice(-400),
      }));
      get().toast(`ERR: ${String(e)}`, "err");
    }
  },

  cancel: async () => {
    try {
      await api.cancelInstall();
    } catch (e) {
      console.error("cancel failed", e);
    }
  },

  removeJob: (id) => {
    if (get().running) return;
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
    get().toggle(id);
    set({ lastSynced: Object.keys(get().selected) });
  },

  clearFinished: () => {
    if (get().running) return;
    set((s) => ({
      jobs: s.jobs.filter(
        (j) => j.status !== "succeeded" && j.status !== "skipped",
      ),
    }));
  },

  handleEvent: (e) => {
    if (e.type === "finished") {
      set({ running: false });
      const done = get().jobs.filter((j) => j.status === "succeeded").length;
      const total = get().jobs.length;
      get().toast(`done: ${done}/${total}`, done === total ? "ok" : "info");
      return;
    }
    if (e.type === "overall") {
      set({ overall: e.total === 0 ? 0 : (e.done / e.total) * 100 });
      return;
    }
    if (e.type === "log") {
      set((s) => ({
        log: [...s.log, `[${e.item}] ${e.message}`].slice(-400),
        jobs: s.jobs.map((j: Job) =>
          j.id === e.item ? { ...j, logTail: e.message } : j,
        ),
      }));
      return;
    }
    set((s) => ({
      jobs: s.jobs.map((j: Job) =>
        j.id === e.item
          ? { ...j, status: e.status, progress: e.progress }
          : j,
      ),
    }));
  },
});
