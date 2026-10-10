import { describe, expect, it } from "vitest";
import { categoryName, letters } from "./tiles";

describe("letters", () => {
  it("takes initials of first two words", () => {
    expect(letters("Visual Studio")).toBe("VS");
    expect(letters("7-Zip")).toBe("7Z");
    expect(letters("qBittorrent")).toBe("Q");
  });
  it("falls back to ?", () => {
    expect(letters("")).toBe("?");
    expect(letters("---")).toBe("?");
  });
});

describe("categoryName", () => {
  it("localizes known categories", () => {
    expect(categoryName("Frontend", "ru")).toBe("Фронтенд");
    expect(categoryName("Frontend", "en")).toBe("Frontend");
  });
  it("falls back to raw id", () => {
    expect(categoryName("Nope" as never, "ru")).toBe("Nope");
  });
});
