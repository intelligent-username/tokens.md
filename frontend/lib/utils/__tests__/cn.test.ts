import { describe, expect, it } from "vitest";
import { cn } from "../cn";

describe("cn utility", () => {
  it("joins simple class names", () => {
    expect(cn("px-4", "py-2", "text-white")).toBe("px-4 py-2 text-white");
  });

  it("handles conditional classes and falsy values", () => {
    expect(cn("base-class", true && "is-active", false && "is-hidden", null, undefined)).toBe("base-class is-active");
  });

  it("resolves and merges conflicting Tailwind classes", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("bg-red-500", "bg-transparent hover:bg-red-600")).toBe("bg-transparent hover:bg-red-600");
  });

  it("handles array inputs and objects", () => {
    expect(cn(["btn", "btn-primary"], { "opacity-50": false, "pointer-events-none": true })).toBe("btn btn-primary pointer-events-none");
  });
});
