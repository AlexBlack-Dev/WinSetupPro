import type { Tab, Toast } from "../../types";
import type { Slice } from "../types";

let nextToastId = 1;

export const createUiSlice: Slice<import("../types").UiSlice> = (set) => ({
  tab: "catalog",
  setTab: (tab: Tab) => set({ tab }),

  toasts: [],
  toast: (text: string, kind: Toast["kind"] = "info") => {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 4200);
  },
  dismissToast: (id: number) =>
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
});
