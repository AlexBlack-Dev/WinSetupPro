import { open, save } from "@tauri-apps/plugin-dialog";

export async function openDialogSave(): Promise<string | null> {
  const file = await save({
    defaultPath: "winsetuppro-preset.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  return file;
}

export async function openDialogOpen(): Promise<string | null> {
  const file = await open({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  return typeof file === "string" ? file : null;
}
