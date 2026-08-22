import { describe, expect, it } from "vitest";
import { deltaPercent, formatTokens } from "../format";

describe("formatTokens", () => {
  it("formats positive numbers with thousands separators", () => {
    expect(formatTokens(1000)).toBe("1,000");
    expect(formatTokens(142000)).toBe("142,000");
    expect(formatTokens(1234567)).toBe("1,234,567");
  });

  it("handles 0 and small integers", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(5)).toBe("5");
    expect(formatTokens(999)).toBe("999");
  });

  it("rounds floating point token numbers", () => {
    expect(formatTokens(1000.4)).toBe("1,000");
    expect(formatTokens(1000.6)).toBe("1,001");
  });

  it("handles negative numbers", () => {
    expect(formatTokens(-500)).toBe("-500");
    expect(formatTokens(-12500)).toBe("-12,500");
  });
});

describe("deltaPercent", () => {
  it("calculates positive savings percentage when target < source", () => {
    expect(deltaPercent(100, 20)).toBe(80);
    expect(deltaPercent(1000, 500)).toBe(50);
  });

  it("calculates negative percentage when tokens expand (target > source)", () => {
    expect(deltaPercent(100, 150)).toBe(-50);
  });

  it("returns 0 when source is 0 to avoid division by zero", () => {
    expect(deltaPercent(0, 50)).toBe(0);
    expect(deltaPercent(0, 0)).toBe(0);
  });

  it("returns 0 when target equals source", () => {
    expect(deltaPercent(100, 100)).toBe(0);
  });

  it("calculates precise floating percentage changes", () => {
    expect(deltaPercent(300, 100)).toBeCloseTo(66.6666, 3);
  });
});
