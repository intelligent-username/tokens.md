import { describe, expect, it } from "vitest";
import { formatBytes } from "@/components/ui/FileChip";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [525, "525 B"],
    [999, "999 B"],
    [1000, "1.0 KB"],
    [525000, "525 KB"],
    [999000, "999 KB"],
    [1000000, "1.0 MB"],
    [1001000, "1.0 MB"],
    [1250000, "1.3 MB"],
    [12000000, "12 MB"],
    [1000000000, "1.0 GB"],
  ])("formats %i bytes as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});
