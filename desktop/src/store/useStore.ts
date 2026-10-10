import { create } from "zustand";
import type { Store } from "./types";
import { createCatalogSlice } from "./slices/catalogSlice";
import { createQueueSlice } from "./slices/queueSlice";
import { createSettingsSlice } from "./slices/settingsSlice";
import { createUiSlice } from "./slices/uiSlice";

export const useStore = create<Store>()((...args) => ({
  ...createCatalogSlice(...args),
  ...createQueueSlice(...args),
  ...createSettingsSlice(...args),
  ...createUiSlice(...args),
}));

export type { Store };
