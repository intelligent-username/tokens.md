import { describe, expect, it } from "vitest";
import copy, * as copyExports from "../../copy";

describe("copy registry", () => {
  it("provides default copy object with core domain keys", () => {
    expect(copy).toBeDefined();
    expect(typeof copy).toBe("object");
  });

  it("exports named domain modules", () => {
    expect(copyExports).toBeDefined();
  });
});
