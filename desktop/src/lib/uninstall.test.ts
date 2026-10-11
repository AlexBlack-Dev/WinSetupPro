import { describe, expect, it } from "vitest";
import { canUninstall, toUninstallItem } from "./uninstall";

describe("canUninstall", () => {
  it("allows winget entries", () => {
    expect(canUninstall({ wingetId: "7zip.7zip", uninstallString: null })).toBe(true);
  });
  it("allows registry entries with uninstall string", () => {
    expect(canUninstall({ wingetId: null, uninstallString: "MsiExec.exe /I{GUID}" })).toBe(true);
  });
  it("rejects store-only entries", () => {
    expect(canUninstall({ wingetId: null, uninstallString: null })).toBe(false);
  });
});

describe("toUninstallItem", () => {
  it("keeps slim shape", () => {
    expect(toUninstallItem("x", "X", null, null, null)).toEqual({
      id: "x",
      displayName: "X",
      wingetId: null,
      scoopName: null,
      uninstallString: null,
    });
  });
});
