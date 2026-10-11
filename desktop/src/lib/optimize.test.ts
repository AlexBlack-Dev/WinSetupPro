import { describe, expect, it } from "vitest";
import { formatGb, formatMb, KNOWN_TWEAK_IDS, TWEAK_META } from "./optimize";

describe("formatMb", () => {
  it("formats megabytes", () => {
    expect(formatMb(512)).toBe("512.0 MB");
  });
  it("rolls over to gigabytes", () => {
    expect(formatMb(2048)).toBe("2.0 GB");
  });
  it("guards garbage", () => {
    expect(formatMb(NaN)).toBe("0 MB");
    expect(formatMb(-5)).toBe("0 MB");
  });
});

describe("formatGb", () => {
  it("formats gigabytes", () => {
    expect(formatGb(15.94)).toBe("15.9 GB");
  });
});

describe("tweak meta", () => {
  it("covers every known tweak in both languages", () => {
    expect(Object.keys(TWEAK_META).sort()).toEqual([...KNOWN_TWEAK_IDS].sort());
    for (const m of Object.values(TWEAK_META)) {
      expect(m.ru).toBeTruthy();
      expect(m.en).toBeTruthy();
      expect(m.descRu).toBeTruthy();
      expect(m.descEn).toBeTruthy();
    }
  });
});
