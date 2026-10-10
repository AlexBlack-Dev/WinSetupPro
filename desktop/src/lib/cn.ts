import { twMerge } from "tailwind-merge";

type Class = string | false | null | undefined;

export function cn(...parts: Class[]): string {
  return twMerge(parts.filter(Boolean).join(" "));
}
