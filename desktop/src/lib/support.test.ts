import { describe, expect, it } from "vitest";
import { buildIssueUrl, isAllowedExternal } from "./support";

describe("isAllowedExternal", () => {
  it("allows own github pages", () => {
    expect(isAllowedExternal("https://github.com/AlexBlack-Dev")).toBe(true);
    expect(isAllowedExternal("https://github.com/AlexBlack-Dev/WinSetupPro/releases/latest")).toBe(true);
  });
  it("blocks everything else", () => {
    expect(isAllowedExternal("https://evil.com")).toBe(false);
    expect(isAllowedExternal("https://github.com.evil.com/x")).toBe(false);
    expect(isAllowedExternal("http://github.com/AlexBlack-Dev")).toBe(false);
  });
});

describe("buildIssueUrl", () => {
  it("prefills version and log tail", () => {
    const url = buildIssueUrl("0.2.0", "ru", ["a", "b"]);
    expect(url.startsWith("https://github.com/AlexBlack-Dev/WinSetupPro/issues/new?")).toBe(true);
    expect(decodeURIComponent(url)).toContain("0.2.0");
  });
});
