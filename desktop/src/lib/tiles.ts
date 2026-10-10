import type { Category } from "./api";
import type { Lang } from "../types";

/** One blue family (matches the cube logo) — cohesive in both themes. */
export const CATEGORY_GRADIENT: Record<Category, [string, string]> = {
  Essential: ["#1D4ED8", "#3B82F6"],
  Browser: ["#0284C7", "#38BDF8"],
  DevCore: ["#4338CA", "#818CF8"],
  Frontend: ["#0369A1", "#22D3EE"],
  Backend: ["#1E40AF", "#60A5FA"],
  PythonAi: ["#0E7490", "#22D3EE"],
  Gamedev: ["#1E3A8A", "#3B82F6"],
  Design3D: ["#3730A3", "#60A5FA"],
  Office: ["#2563EB", "#93C5FD"],
  Media: ["#0C4A6E", "#38BDF8"],
  Gaming: ["#312E81", "#818CF8"],
  Network: ["#075985", "#38BDF8"],
  Utilities: ["#475569", "#94A3B8"],
  Runtime: ["#334155", "#64748B"],
};

export const tileGradient = (c: Category): string => {
  const [a, b] = CATEGORY_GRADIENT[c] ?? CATEGORY_GRADIENT.Essential;
  return `linear-gradient(135deg, ${a}, ${b})`;
};

/** 1–2 bold letters: "Visual Studio" → "VS", "7-Zip" → "7Z". */
export const letters = (nameEn: string): string => {
  const chars = nameEn
    .split(/[\s\-_.]+/)
    .map((p) => [...p].find((ch) => /[A-Za-z0-9]/.test(ch)))
    .filter((c): c is string => !!c)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return chars || "?";
};

const NAMES: Record<Category, { ru: string; en: string }> = {
  Essential: { ru: "База", en: "Essential" },
  Browser: { ru: "Браузеры", en: "Browsers" },
  DevCore: { ru: "Разработка", en: "Dev core" },
  Frontend: { ru: "Фронтенд", en: "Frontend" },
  Backend: { ru: "Бэкенд", en: "Backend" },
  PythonAi: { ru: "Python и ИИ", en: "Python & AI" },
  Gamedev: { ru: "Геймдев", en: "Gamedev" },
  Design3D: { ru: "Дизайн и 3D", en: "Design & 3D" },
  Office: { ru: "Офис", en: "Office" },
  Media: { ru: "Медиа", en: "Media" },
  Gaming: { ru: "Игры", en: "Gaming" },
  Network: { ru: "Сеть", en: "Network" },
  Utilities: { ru: "Утилиты", en: "Utilities" },
  Runtime: { ru: "Рантаймы", en: "Runtimes" },
};

export const categoryName = (c: Category, lang: Lang): string =>
  NAMES[c]?.[lang] ?? c;

export const iconDataUri = (svg: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
