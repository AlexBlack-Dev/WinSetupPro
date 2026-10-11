import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./version";
import pkg from "../package.json";

describe("version", () => {
  it("is semver", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it("matches package.json (single source of truth)", () => {
    expect(APP_VERSION).toBe(pkg.version);
  });
});
