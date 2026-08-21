/**
 * Tests for lib/api/client.ts
 *
 * Covers: ApiError class, parseError(), fetchJson(), getHealth(),
 * getConfig(), getSamples(), fetchSample()
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE, ApiError, fetchJson, fetchSample, getConfig, getHealth, getSamples, parseError } from "../client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(status: number, body: unknown, ok = status >= 200 && status < 300) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const blob = new Blob([text]);
  const response: Partial<Response> = {
    ok,
    status,
    json: () => Promise.resolve(typeof body === "string" ? JSON.parse(body) : body),
    text: () => Promise.resolve(text),
    blob: () => Promise.resolve(blob),
  };
  global.fetch = vi.fn().mockResolvedValue(response as Response);
}

function mockFetchReject(err: Error) {
  global.fetch = vi.fn().mockRejectedValue(err);
}

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe("ApiError", () => {
  it("stores all constructor arguments", () => {
    const body = { message: "oops", code: "bad_request" };
    const err = new ApiError("oops", "unknown", 400, body);

    expect(err.message).toBe("oops");
    expect(err.name).toBe("ApiError");
    expect(err.kind).toBe("unknown");
    expect(err.status).toBe(400);
    expect(err.body).toBe(body);
    expect(err).toBeInstanceOf(Error);
  });

  it("works with only required arguments", () => {
    const err = new ApiError("network failure", "network");
    expect(err.status).toBeUndefined();
    expect(err.body).toBeUndefined();
    expect(err.kind).toBe("network");
  });
});

// ---------------------------------------------------------------------------
// parseError
// ---------------------------------------------------------------------------

describe("parseError", () => {
  it("classifies 'unsupported_format' code from body.code", () => {
    const err = parseError(422, JSON.stringify({ code: "unsupported_format", message: "bad type" }));
    expect(err.kind).toBe("unsupported_format");
    expect(err.message).toBe("bad type");
    expect(err.status).toBe(422);
  });

  it("classifies 'too_large' from body.error field (fallback key)", () => {
    const err = parseError(413, JSON.stringify({ error: "too_large", message: "file too big" }));
    expect(err.kind).toBe("too_large");
    expect(err.message).toBe("file too big");
  });

  it("prefers body.code over body.error when both present", () => {
    const err = parseError(422, JSON.stringify({ code: "unsupported_format", error: "not_found", message: "check code" }));
    expect(err.kind).toBe("unsupported_format");
  });

  it("falls back to 'unknown' when JSON parse fails", () => {
    const err = parseError(500, "not json at all");
    expect(err.kind).toBe("unknown");
    expect(err.status).toBe(500);
    expect(err.message).toBe("HTTP 500");
    expect(err.body).toBeUndefined();
  });

  it("falls back to 'unknown' when body has no code or error key", () => {
    const err = parseError(400, JSON.stringify({ message: "something went wrong" }));
    expect(err.kind).toBe("unknown");
    expect(err.message).toBe("something went wrong");
  });

  it("uses 'HTTP {status}' as message when body has no message", () => {
    const err = parseError(500, JSON.stringify({ code: "unknown" }));
    expect(err.message).toBe("HTTP 500");
  });

  it("classifies 'not_found' code", () => {
    const err = parseError(404, JSON.stringify({ code: "not_found", message: "gone" }));
    expect(err.kind).toBe("not_found");
  });

  it("classifies 'bad_request' code as 'unknown' (no direct mapping)", () => {
    const err = parseError(400, JSON.stringify({ code: "bad_request", message: "bad" }));
    // bad_request has no substring match → falls through to "unknown"
    expect(err.kind).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// fetchJson
// ---------------------------------------------------------------------------

describe("fetchJson", () => {
  it("GETs JSON and returns parsed response", async () => {
    const payload = { version: "1.0", encoding: "o200k_base", extensions: ["pdf"] };
    mockFetch(200, payload);

    const result = await fetchJson<typeof payload>("/api/health");
    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledOnce();
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("/api/health");
  });

  it("automatically sets Content-Type: application/json for JSON body", async () => {
    mockFetch(200, { ok: true });

    await fetchJson("/api/convert", { method: "POST", body: JSON.stringify({ session_id: "abc" }) });

    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("does NOT set Content-Type for FormData body", async () => {
    mockFetch(201, { session_id: "s1", files: [] });

    const form = new FormData();
    form.append("file", new Blob(["data"]), "test.pdf");
    await fetchJson("/api/uploads", { method: "POST", body: form });

    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    // Content-Type should NOT be set — browser sets it with boundary for multipart
    expect((init.headers as Headers).has("Content-Type")).toBe(false);
  });

  it("returns undefined for 204 No Content", async () => {
    mockFetch(204, "", true);

    const result = await fetchJson<undefined>("/api/noop");
    expect(result).toBeUndefined();
  });

  it("throws ApiError with kind 'network' on fetch rejection", async () => {
    mockFetchReject(new TypeError("Failed to fetch"));

    await expect(fetchJson("/api/health")).rejects.toMatchObject({
      name: "ApiError",
      kind: "network",
      message: "Network error",
    });
  });

  it("throws ApiError on 4xx responses", async () => {
    mockFetch(422, { code: "unsupported_format", message: "bad file" }, false);

    const err = await fetchJson("/api/convert").catch((e: unknown) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.kind).toBe("unsupported_format");
    expect(err.message).toBe("bad file");
  });

  it("throws ApiError on 500 responses", async () => {
    mockFetch(500, { code: "internal_error", message: "server exploded" }, false);

    const err = await fetchJson("/api/convert").catch((e: unknown) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
  });

  it("throws ApiError on 413 too_large", async () => {
    mockFetch(413, { code: "too_large", message: "file exceeds limit" }, false);

    const err = await fetchJson("/api/uploads").catch((e: unknown) => e as ApiError);
    expect(err.kind).toBe("too_large");
    expect(err.status).toBe(413);
  });

  it("prepends API_BASE to the path", async () => {
    mockFetch(200, {});
    await fetchJson("/api/test");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe(`${API_BASE}/api/test`);
  });
});

// ---------------------------------------------------------------------------
// getHealth / getConfig / getSamples
// ---------------------------------------------------------------------------

describe("getHealth", () => {
  it("GETs /api/health and returns HealthResponse shape", async () => {
    const payload = { version: "0.0.5", encoding: "o200k_base", extensions: ["pdf", "docx"] };
    mockFetch(200, payload);

    const result = await getHealth();
    expect(result.version).toBe("0.0.5");
    expect(result.encoding).toBe("o200k_base");
    expect(result.extensions).toContain("pdf");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/api/health");
  });
});

describe("getConfig", () => {
  it("GETs /api/config and returns ConfigResponse shape", async () => {
    const payload = {
      extensions: ["pdf", "docx"],
      limits: { max_upload_mb: 100, max_session_mb: 1000, session_ttl_hours: 24 },
      feature_flags: { allow_local_paths: false },
    };
    mockFetch(200, payload);

    const result = await getConfig();
    expect(result.limits.max_upload_mb).toBe(100);
    expect(result.feature_flags.allow_local_paths).toBe(false);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/api/config");
  });
});

describe("getSamples", () => {
  it("GETs /api/samples and returns SamplesResponse", async () => {
    const payload = { samples: [{ name: "sample.pdf", kind: "pdf" }] };
    mockFetch(200, payload);

    const result = await getSamples();
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].name).toBe("sample.pdf");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/api/samples");
  });
});

// ---------------------------------------------------------------------------
// fetchSample
// ---------------------------------------------------------------------------

describe("fetchSample", () => {
  it("GETs /api/samples/{name} and returns a Blob", async () => {
    mockFetch(200, "binary data here");

    const blob = await fetchSample("sample.pdf");
    expect(blob).toBeInstanceOf(Blob);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/api/samples/sample.pdf");
  });

  it("URL-encodes the sample name", async () => {
    mockFetch(200, "data");

    await fetchSample("my sample.pdf");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("my%20sample.pdf");
  });

  it("throws ApiError with kind 'network' on fetch rejection", async () => {
    mockFetchReject(new TypeError("fetch failed"));

    await expect(fetchSample("x.pdf")).rejects.toMatchObject({
      name: "ApiError",
      kind: "network",
    });
  });

  it("throws ApiError on non-2xx status", async () => {
    mockFetch(404, { code: "not_found", message: "no sample" }, false);

    const err = await fetchSample("missing.pdf").catch((e: unknown) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
  });
});
