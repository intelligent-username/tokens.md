import { describe, expect, it, vi } from "vitest";
import { API_BASE, fetchJson, wsUrl } from "../apiBase";

describe("apiBase", () => {
  it("exports a non-empty API_BASE string", () => {
    expect(typeof API_BASE).toBe("string");
    expect(API_BASE.length).toBeGreaterThan(0);
  });

  it("constructs WebSocket URL with session_id query parameter", () => {
    const url = wsUrl("test-session-123");
    expect(url).toMatch(/^ws/);
    expect(url).toContain("/api/ws?session_id=test-session-123");
  });

  it("URL-encodes session_id in wsUrl", () => {
    const url = wsUrl("session/with spaces & special#chars");
    expect(url).toContain("session%2Fwith%20spaces%20%26%20special%23chars");
  });

  describe("fetchJson", () => {
    it("fetches and parses JSON successfully on 2xx responses", async () => {
      const mockData = { status: "healthy", version: "1.0" };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
      } as unknown as Response);

      const result = await fetchJson<typeof mockData>("/api/health");
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/health`,
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("throws an error when HTTP status is not ok (4xx/5xx)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "not found" }),
      } as unknown as Response);

      await expect(fetchJson("/api/missing")).rejects.toThrow("HTTP 404");
    });
  });
});
