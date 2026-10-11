export function formatMb(mb: number): string {
  if (!Number.isFinite(mb) || mb < 0) return "0 MB";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export function formatGb(gb: number): string {
  if (!Number.isFinite(gb) || gb < 0) return "0 GB";
  return `${gb.toFixed(1)} GB`;
}

/** Mirrors optimizer.rs TWEAKS. Tested for parity below. */
export const KNOWN_TWEAK_IDS = [
  "power-ultimate",
  "game-mode",
  "visual-performance",
  "telemetry-basic",
  "background-apps",
] as const;

export type TweakId = (typeof KNOWN_TWEAK_IDS)[number];

export const TWEAK_META: Record<TweakId, { ru: string; en: string; descRu: string; descEn: string }> = {
  "power-ultimate": {
    ru: "Максимальная производительность",
    en: "Ultimate performance",
    descRu: "Схема питания для минимальной задержки. Откат — сбалансированная.",
    descEn: "Power plan for minimal latency. Revert restores balanced.",
  },
  "game-mode": {
    ru: "Игровой режим",
    en: "Game mode",
    descRu: "Приоритет игры в планировщике Windows.",
    descEn: "Game priority in the Windows scheduler.",
  },
  "visual-performance": {
    ru: "Быстродействие визуала",
    en: "Visual performance",
    descRu: "Отключает анимации и тени. Откат — выбор Windows.",
    descEn: "Disables animations and shadows. Revert restores Windows choice.",
  },
  "telemetry-basic": {
    ru: "Минимум телеметрии",
    en: "Minimal telemetry",
    descRu: "Базовый уровень диагностики вместо полного.",
    descEn: "Basic diagnostics instead of full.",
  },
  "background-apps": {
    ru: "Фоновые приложения выкл",
    en: "Background apps off",
    descRu: "Запрет фоновой работы UWP-приложений.",
    descEn: "Blocks background UWP apps.",
  },
};

const TWEAK_CACHE_KEY = "wsp:tweaks";

export function loadTweakCache(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(TWEAK_CACHE_KEY);
    if (!raw) return {};
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return {};
    const out: Record<string, boolean> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "boolean") out[k] = val;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveTweakCache(states: Record<string, boolean>): void {
  try {
    localStorage.setItem(TWEAK_CACHE_KEY, JSON.stringify(states));
  } catch {
    /* cache must never crash the app */
  }
}
