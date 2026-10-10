import { useStore } from "../store/useStore";
import { translations } from "./translations";

/** Bound translator: re-renders on language change. */
export function useT(): (key: string) => string {
  const lang = useStore((s) => s.lang);
  return (key: string) => translations[lang][key] ?? key;
}
