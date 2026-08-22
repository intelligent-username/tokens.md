/**
 * Security regression tests: session/file IDs are always URL-encoded when
 * interpolated into request paths, so a hostile ID (e.g. "../..") cannot
 * alter the request path (path traversal via URL segments).
 */
import { describe, expect, it, vi } from "vitest";
import { API_BASE } from "../client";
import { downloadAllUrl, downloadUrl, listFiles, sessionCancel, watchStatus } from "../endpoints";

const HOSTILE_ID = "../../evil";

function mockFetchOk(body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

async function fetchedUrl(): Promise<string> {
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls[0][0] as string;
}

describe("session id traversal safety", () => {
  it("downloadAllUrl encodes traversal segments", () => {
    const url = downloadAllUrl(HOSTILE_ID);
    expect(url).toBe(`${API_BASE}/api/files/${encodeURIComponent(HOSTILE_ID)}/download-all`);
    expect(url).not.toContain("/files/../../");
  });

  it("downloadUrl encodes traversal segments in both ids", () => {
    const url = downloadUrl(HOSTILE_ID, "../file");
    expect(url).not.toContain("/../");
    expect(url).toContain(encodeURIComponent(HOSTILE_ID));
    expect(url).toContain(encodeURIComponent("../file"));
  });

  it("listFiles encodes traversal segments", async () => {
    mockFetchOk({ files: [] });
    await listFiles(HOSTILE_ID);
    const url = await fetchedUrl();
    expect(url).toContain(encodeURIComponent(HOSTILE_ID));
    expect(url).not.toContain(HOSTILE_ID);
  });

  it("watchStatus encodes traversal segments", async () => {
    mockFetchOk({ status: "idle" });
    await watchStatus(HOSTILE_ID);
    const url = await fetchedUrl();
    expect(url).toContain(encodeURIComponent(HOSTILE_ID));
    expect(url).not.toContain(HOSTILE_ID);
  });

  it("sessionCancel encodes traversal segments", async () => {
    mockFetchOk({ cancelled: true });
    await sessionCancel(HOSTILE_ID);
    const url = await fetchedUrl();
    expect(url).toContain(encodeURIComponent(HOSTILE_ID));
    expect(url).not.toContain(HOSTILE_ID);
  });
});
