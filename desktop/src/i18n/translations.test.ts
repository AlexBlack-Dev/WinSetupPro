import { describe, expect, it } from "vitest";
import { translations, statusText } from "./translations";

describe("translations", () => {
  it("every key has non-empty ru+en strings", () => {
    for (const [key, value] of Object.entries(translations.ru)) {
      expect(value, `ru:${key}`).toBeTruthy();
      expect(translations.en[key], `en:${key}`).toBeTruthy();
    }
  });
  it("covers all job statuses", () => {
    for (const s of ["queued", "running", "succeeded", "failed", "skipped", "cancelled"]) {
      expect(statusText("ru", s)).not.toBe(s);
      expect(statusText("en", s)).not.toBe(s);
    }
  });
});
