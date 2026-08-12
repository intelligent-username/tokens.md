/**
 * Tests for lib/api/endpoints.ts
 *
 * Covers all 17 typed REST endpoint functions: uploadFiles, convert, merge,
 * budget, delta, fetchUrl, repo, clip, listFiles, downloadUrl, downloadAllUrl,
 * watchStart, watchStop, watchStatus, sessionClose, sessionCancel, plus the
 * non-XHR upload variant.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { budget, clip, convert, delta, downloadAllUrl, downloadUrl, fetchUrl, listFiles, merge, repo, sessionCancel, sessionClose, uploadFiles, watchStart, watchStatus, watchStop } from "../endpoints";
import { API_BASE } from "../client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(status: number, body: unknown) {
  const ok = status >= 200 && status < 300;
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

function lastCall() {
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
  const [url, init] = calls[calls.length - 1] as [string, RequestInit];
  return { url, init, body: init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined };
}

// ---------------------------------------------------------------------------
// uploadFiles (fetch / FormData variant in endpoints.ts)
// ---------------------------------------------------------------------------

describe("uploadFiles (endpoints)", () => {
  it("POSTs FormData to /api/uploads and returns UploadResponse", async () => {
    const payload = { session_id: "sess-1", files: [{ file_id: "f1", name: "doc.pdf", size: 1024 }] };
    mockFetch(201, payload);

    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
    const result = await uploadFiles([file], ["doc.pdf"]);

    expect(result.session_id).toBe("sess-1");
    expect(result.files).toHaveLength(1);
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain("/api/uploads");
    expect(call[1].method).toBe("POST");
    expect(call[1].body).toBeInstanceOf(FormData);
  });

  it("appends session_id to FormData when provided", async () => {
    mockFetch(201, { session_id: "s1", files: [] });

    const file = new File(["x"], "x.txt");
    await uploadFiles([file], ["x.txt"], "sess-abc");

    const form = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as FormData;
    expect(form.get("session_id")).toBe("sess-abc");
  });

  it("omits session_id from FormData when not provided", async () => {
    mockFetch(201, { session_id: "new", files: [] });

    const file = new File(["x"], "x.txt");
    await uploadFiles([file], ["x.txt"]);

    const form = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as FormData;
    expect(form.get("session_id")).toBeNull();
  });

  it("serialises paths as a JSON string in FormData", async () => {
    mockFetch(201, { session_id: "s", files: [] });

    const file = new File(["x"], "sub/doc.pdf");
    await uploadFiles([file], ["sub/doc.pdf"]);

    const form = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as FormData;
    expect(JSON.parse(form.get("paths") as string)).toEqual(["sub/doc.pdf"]);
  });
});

// ---------------------------------------------------------------------------
// convert
// ---------------------------------------------------------------------------

describe("convert", () => {
  it("POSTs to /api/convert with correct body shape", async () => {
    const payload = { results: [], converted_count: 0, failed_count: 0, total_source_tokens: 0, total_target_tokens: 0, total_percent: 0 };
    mockFetch(200, payload);

    const req = { session_id: "s1", file_ids: ["f1", "f2"], options: { recursive: false } };
    const result = await convert(req);

    expect(result.converted_count).toBe(0);
    const { url, body } = lastCall();
    expect(url).toContain("/api/convert");
    expect(body?.session_id).toBe("s1");
    expect(body?.file_ids).toEqual(["f1", "f2"]);
  });

  it("returns parsed ConvertResponse with results array", async () => {
    const payload = {
      results: [{ file_id: "f1", name: "doc.pdf", status: "done", source_tokens: 500, target_tokens: 100, percent: -80 }],
      converted_count: 1,
      failed_count: 0,
      total_source_tokens: 500,
      total_target_tokens: 100,
      total_percent: -80,
    };
    mockFetch(200, payload);

    const result = await convert({ session_id: "s1", file_ids: ["f1"] });
    expect(result.results[0].status).toBe("done");
    expect(result.total_percent).toBe(-80);
  });
});

// ---------------------------------------------------------------------------
// merge
// ---------------------------------------------------------------------------

describe("merge", () => {
  it("POSTs to /api/merge with correct body", async () => {
    const payload = { output_file_id: "out1", output_name: "merged.md", source_tokens: 1000, target_tokens: 200, percent: -80 };
    mockFetch(200, payload);

    const req = { session_id: "s1", file_ids: ["f1", "f2"], output_name: "merged.md", options: { budget: 4000, dedup: true } };
    const result = await merge(req);

    expect(result.output_file_id).toBe("out1");
    const { url, body } = lastCall();
    expect(url).toContain("/api/merge");
    expect(body?.options).toMatchObject({ budget: 4000, dedup: true });
  });

  it("includes prune report when budget pruning occurred", async () => {
    const payload = {
      output_file_id: "out2",
      output_name: "merged.md",
      source_tokens: 1000,
      target_tokens: 4000,
      percent: 0,
      prune: { fits: true, removed_tokens: 0, removed_blocks: 0, budget: 4000, final_tokens: 4000 },
    };
    mockFetch(200, payload);

    const result = await merge({ session_id: "s1", file_ids: ["f1"] });
    expect(result.prune?.fits).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// budget
// ---------------------------------------------------------------------------

describe("budget", () => {
  it("POSTs to /api/budget with file_id", async () => {
    const payload = { fits: true, original_tokens: 500, final_tokens: 400, removed_tokens: 100, removed_blocks: 2 };
    mockFetch(200, payload);

    const result = await budget({ session_id: "s1", file_id: "f1", budget: 4000 });
    expect(result.fits).toBe(true);
    const { url, body } = lastCall();
    expect(url).toContain("/api/budget");
    expect(body?.file_id).toBe("f1");
    expect(body?.budget).toBe(4000);
  });

  it("POSTs to /api/budget with raw text", async () => {
    const payload = { fits: false, original_tokens: 9000, final_tokens: 4000, removed_tokens: 5000, removed_blocks: 10 };
    mockFetch(200, payload);

    const result = await budget({ session_id: "s1", text: "lots of text", budget: 4000 });
    expect(result.fits).toBe(false);
    const { body } = lastCall();
    expect(body?.text).toBe("lots of text");
  });
});

// ---------------------------------------------------------------------------
// delta
// ---------------------------------------------------------------------------

describe("delta", () => {
  it("POSTs to /api/delta and returns DeltaResponse", async () => {
    const payload = {
      entries: [{ file: "doc.pdf", source_tokens: 500, target_tokens: 100, percent: -80 }],
      total_source_tokens: 500,
      total_target_tokens: 100,
      total_percent: -80,
    };
    mockFetch(200, payload);

    const result = await delta({ session_id: "s1", file_ids: ["f1"] });
    expect(result.entries).toHaveLength(1);
    expect(result.total_percent).toBe(-80);
    const { url } = lastCall();
    expect(url).toContain("/api/delta");
  });
});

// ---------------------------------------------------------------------------
// fetchUrl
// ---------------------------------------------------------------------------

describe("fetchUrl", () => {
  it("POSTs to /api/fetch with URL and session_id", async () => {
    const payload = { session_id: "s1", output_file_id: "f-out", output_name: "article.md", source_tokens: 800, target_tokens: 200, percent: -75, url: "https://example.com" };
    mockFetch(200, payload);

    const result = await fetchUrl({ url: "https://example.com", session_id: "s1" });
    expect(result.output_name).toBe("article.md");
    const { url, body } = lastCall();
    expect(url).toContain("/api/fetch");
    expect(body?.url).toBe("https://example.com");
    expect(body?.session_id).toBe("s1");
  });

  it("sends optional user_agent when provided", async () => {
    mockFetch(200, { output_file_id: "f1", output_name: "a.md", source_tokens: 0, target_tokens: 0, percent: 0, url: "https://x.com" });

    await fetchUrl({ url: "https://x.com", user_agent: "TestBot/1.0" });
    const { body } = lastCall();
    expect(body?.user_agent).toBe("TestBot/1.0");
  });
});

// ---------------------------------------------------------------------------
// repo
// ---------------------------------------------------------------------------

describe("repo", () => {
  it("POSTs to /api/repo with file_ids", async () => {
    const payload = { output_file_id: "repo-out", output_name: "repo.md", source_tokens: 2000, target_tokens: 500, percent: -75, file_count: 12 };
    mockFetch(200, payload);

    const result = await repo({ session_id: "s1", file_ids: ["f1", "f2"] });
    expect(result.file_count).toBe(12);
    const { url, body } = lastCall();
    expect(url).toContain("/api/repo");
    expect(body?.file_ids).toEqual(["f1", "f2"]);
  });

  it("sends exclude patterns when provided", async () => {
    mockFetch(200, { output_file_id: "r", output_name: "r.md", source_tokens: 0, target_tokens: 0, percent: 0, file_count: 0 });

    await repo({ session_id: "s1", file_ids: ["f1"], exclude: ["node_modules", "*.lock"] });
    const { body } = lastCall();
    expect(body?.exclude).toEqual(["node_modules", "*.lock"]);
  });
});

// ---------------------------------------------------------------------------
// clip
// ---------------------------------------------------------------------------

describe("clip", () => {
  it("POSTs to /api/clip and returns ClipResponse", async () => {
    const payload = { text: "# Hello", chars: 7, lines: 1, tokens: 3, file_count: 1 };
    mockFetch(200, payload);

    const result = await clip({ session_id: "s1", file_ids: ["f1"] });
    expect(result.text).toBe("# Hello");
    expect(result.tokens).toBe(3);
    const { url } = lastCall();
    expect(url).toContain("/api/clip");
  });
});

// ---------------------------------------------------------------------------
// listFiles
// ---------------------------------------------------------------------------

describe("listFiles", () => {
  it("GETs /api/files/{sessionId} and returns ListFilesResponse", async () => {
    const payload = { files: [{ file_id: "f1", name: "out.md", size: 200, target_tokens: 50, created: 1700000000 }] };
    mockFetch(200, payload);

    const result = await listFiles("sess-xyz");
    expect(result.files).toHaveLength(1);
    expect(result.files[0].file_id).toBe("f1");
    const { url, init } = lastCall();
    expect(url).toContain("/api/files/sess-xyz");
    expect(init?.method).toBeUndefined(); // GET (no method override)
  });

  it("URL-encodes the session ID", async () => {
    mockFetch(200, { files: [] });
    await listFiles("session with spaces");
    const { url } = lastCall();
    expect(url).toContain("session%20with%20spaces");
  });
});

// ---------------------------------------------------------------------------
// downloadUrl / downloadAllUrl (pure string builders)
// ---------------------------------------------------------------------------

describe("downloadUrl", () => {
  it("returns a direct download URL without fetching", () => {
    const url = downloadUrl("sess-1", "file-1");
    expect(url).toBe(`${API_BASE}/api/files/sess-1/file-1/download`);
  });

  it("URL-encodes session and file IDs", () => {
    const url = downloadUrl("s/1", "f/2");
    expect(url).toContain("s%2F1");
    expect(url).toContain("f%2F2");
  });
});

describe("downloadAllUrl", () => {
  it("returns a direct download-all URL without fetching", () => {
    const url = downloadAllUrl("sess-1");
    expect(url).toBe(`${API_BASE}/api/files/sess-1/download-all`);
  });
});

// ---------------------------------------------------------------------------
// watchStart / watchStop / watchStatus
// ---------------------------------------------------------------------------

describe("watchStart", () => {
  it("POSTs to /api/watch/start with session_id and options", async () => {
    const payload = { watch_id: "sess-1", source: "/uploads", output: "/output" };
    mockFetch(200, payload);

    const result = await watchStart({ session_id: "sess-1", options: { poll_interval: 1.0, once: true } });
    expect(result.watch_id).toBe("sess-1");
    const { url, body } = lastCall();
    expect(url).toContain("/api/watch/start");
    expect(body?.session_id).toBe("sess-1");
    expect((body?.options as Record<string, unknown>)?.poll_interval).toBe(1.0);
  });
});

describe("watchStop", () => {
  it("POSTs to /api/watch/stop with session_id in body", async () => {
    mockFetch(200, { stopped: true });

    const result = await watchStop("sess-1");
    expect(result.stopped).toBe(true);
    const { url, body } = lastCall();
    expect(url).toContain("/api/watch/stop");
    expect(body?.session_id).toBe("sess-1");
  });
});

describe("watchStatus", () => {
  it("GETs /api/watch/{sessionId} and returns WatchStatus", async () => {
    const payload = { running: true, files_processed: 5, source_tokens: 1000, target_tokens: 200 };
    mockFetch(200, payload);

    const result = await watchStatus("sess-1");
    expect(result.running).toBe(true);
    expect(result.files_processed).toBe(5);
    const { url } = lastCall();
    expect(url).toContain("/api/watch/sess-1");
  });
});

// ---------------------------------------------------------------------------
// sessionClose / sessionCancel
// ---------------------------------------------------------------------------

describe("sessionClose", () => {
  it("POSTs to /api/session/close with session_id", async () => {
    mockFetch(200, { closed: true });

    const result = await sessionClose("sess-1");
    expect(result.closed).toBe(true);
    const { url, body } = lastCall();
    expect(url).toContain("/api/session/close");
    expect(body?.session_id).toBe("sess-1");
  });
});

describe("sessionCancel", () => {
  it("POSTs to /api/session/{id}/cancel with no body", async () => {
    mockFetch(200, { cancelled: true });

    const result = await sessionCancel("sess-1");
    expect(result.cancelled).toBe(true);
    const { url } = lastCall();
    expect(url).toContain("/api/session/sess-1/cancel");
  });

  it("URL-encodes the session ID in the path", async () => {
    mockFetch(200, { cancelled: true });
    await sessionCancel("s/e/s/s");
    const { url } = lastCall();
    expect(url).toContain("s%2Fe%2Fs%2Fs");
  });
});
