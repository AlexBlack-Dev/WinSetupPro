import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy parts", () => {
    const off: boolean = false;
    expect(cn("a", off && "b", "c")).toBe("a c");
  });
  it("resolves tailwind conflicts (last wins)", () => {
    expect(cn("h-9", "h-[33px]")).toBe("h-[33px]");
    expect(cn("rounded-lg", "rounded-[10px]")).toBe("rounded-[10px]");
  });
});
