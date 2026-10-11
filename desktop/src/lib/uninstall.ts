import type { InstalledApp, UninstallItem } from "./api";

export function canUninstall(a: Pick<InstalledApp, "wingetId" | "uninstallString">): boolean {
  return !!(a.wingetId || a.uninstallString);
}

export function toUninstallItem(
  id: string,
  displayName: string,
  wingetId: string | null,
  scoopName: string | null,
  uninstallString: string | null,
): UninstallItem {
  return { id, displayName, wingetId, scoopName, uninstallString };
}
