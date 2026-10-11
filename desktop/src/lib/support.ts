import { openPath, openUrl } from "@tauri-apps/plugin-opener";

const ALLOWED_ROOT = "https://github.com/AlexBlack-Dev";

export function isAllowedExternal(url: string): boolean {
  return url === ALLOWED_ROOT || url.startsWith(ALLOWED_ROOT + "/");
}

export async function openExternal(url: string): Promise<void> {
  if (!isAllowedExternal(url)) throw new Error("external url not allowlisted");
  await openUrl(url);
}

export async function openLocalPath(path: string): Promise<void> {
  await openPath(path);
}

export function buildIssueUrl(version: string, lang: string, logTail: string[]): string {
  const title = encodeURIComponent("Проблема: ");
  const body = encodeURIComponent(
    [
      `Версия: ${version}`,
      `Язык: ${lang}`,
      "",
      "Что делал:",
      "- ",
      "",
      "Лог:",
      "```",
      ...logTail.slice(-30),
      "```",
    ].join("\n"),
  );
  return `https://github.com/AlexBlack-Dev/WinSetupPro/issues/new?title=${title}&body=${body}`;
}
