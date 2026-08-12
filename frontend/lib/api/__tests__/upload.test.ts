/**
 * Tests for lib/api/upload.ts
 *
 * Covers: XHR-based multipart upload, progress reporting, abort via AbortSignal,
 * and all error paths (network error, abort, timeout, non-2xx status codes).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../client";
import { uploadFiles } from "../upload";

// ---------------------------------------------------------------------------
// Minimal XMLHttpRequest mock
// ---------------------------------------------------------------------------

interface XhrMock {
  open: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  // Event handlers the code assigns to
  onload: ((this: XMLHttpRequest) => void) | null;
  onerror: ((this: XMLHttpRequest) => void) | null;
  onabort: ((this: XMLHttpRequest) => void) | null;
  ontimeout: ((this: XMLHttpRequest) => void) | null;
  upload: {
    onprogress: ((e: ProgressEvent) => void) | null;
  };
  status: number;
  responseText: string;
}

let xhrMock: XhrMock;

beforeEach(() => {
  xhrMock = {
    open: vi.fn(),
    send: vi.fn(),
    abort: vi.fn(),
    setRequestHeader: vi.fn(),
    onload: null,
    onerror: null,
    onabort: null,
    ontimeout: null,
    upload: { onprogress: null },
    status: 200,
    responseText: "",
  };

  vi.stubGlobal(
    "XMLHttpRequest",
    vi.fn(() => xhrMock)
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simulateSuccess(responseBody: unknown) {
  xhrMock.status = 200;
  xhrMock.responseText = JSON.stringify(responseBody);
  // Trigger onload after send is called
  xhrMock.send.mockImplementation(() => {
    xhrMock.onload?.call(xhrMock as unknown as XMLHttpRequest);
  });
}

function simulateError(status: number, responseBody: unknown) {
  xhrMock.status = status;
  xhrMock.responseText = JSON.stringify(responseBody);
  xhrMock.send.mockImplementation(() => {
    xhrMock.onload?.call(xhrMock as unknown as XMLHttpRequest);
  });
}

function makeFile(name = "test.pdf", content = "data") {
  return new File([content], name, { type: "application/pdf" });
}

// ---------------------------------------------------------------------------
// Happy-path upload
// ---------------------------------------------------------------------------

describe("uploadFiles (XHR)", () => {
  it("opens POST to /api/uploads", async () => {
    simulateSuccess({ session_id: "s1", files: [] });
    await uploadFiles([makeFile()], ["test.pdf"]);

    expect(xhrMock.open).toHaveBeenCalledWith("POST", expect.stringContaining("/api/uploads"));
  });

  it("sends FormData via xhr.send", async () => {
    simulateSuccess({ session_id: "s1", files: [] });
    await uploadFiles([makeFile()], ["test.pdf"]);

    const formData = xhrMock.send.mock.calls[0][0] as FormData;
    expect(formData).toBeInstanceOf(FormData);
  });

  it("returns the parsed UploadResponse on success", async () => {
    const payload = {
      session_id: "sess-abc",
      files: [{ file_id: "f1", name: "test.pdf", size: 4, source_tokens: 10, relpath: "test.pdf" }],
    };
    simulateSuccess(payload);

    const result = await uploadFiles([makeFile()], ["test.pdf"]);
    expect(result.session_id).toBe("sess-abc");
    expect(result.files[0].file_id).toBe("f1");
  });

  it("appends session_id to FormData when provided", async () => {
    simulateSuccess({ session_id: "s1", files: [] });
    await uploadFiles([makeFile()], ["test.pdf"], "sess-123");

    const form = xhrMock.send.mock.calls[0][0] as FormData;
    expect(form.get("session_id")).toBe("sess-123");
  });

  it("omits session_id from FormData when not provided", async () => {
    simulateSuccess({ session_id: "new", files: [] });
    await uploadFiles([makeFile()], ["test.pdf"]);

    const form = xhrMock.send.mock.calls[0][0] as FormData;
    expect(form.get("session_id")).toBeNull();
  });

  it("uses path as filename for each appended file", async () => {
    simulateSuccess({ session_id: "s", files: [] });
    const file = makeFile("original.pdf");
    await uploadFiles([file], ["sub/dir/renamed.pdf"]);

    const form = xhrMock.send.mock.calls[0][0] as FormData;
    const entry = form.get("files") as File;
    expect(entry.name).toBe("sub/dir/renamed.pdf");
  });

  it("falls back to file.name when path array is short", async () => {
    simulateSuccess({ session_id: "s", files: [] });
    const file = makeFile("fallback.pdf");
    await uploadFiles([file], []); // empty paths array

    const form = xhrMock.send.mock.calls[0][0] as FormData;
    const entry = form.get("files") as File;
    expect(entry.name).toBe("fallback.pdf");
  });
});

// ---------------------------------------------------------------------------
// Progress reporting
// ---------------------------------------------------------------------------

describe("uploadFiles — progress reporting", () => {
  it("calls onProgress with loaded/total from xhr.upload.onprogress", async () => {
    const onProgress = vi.fn();

    xhrMock.status = 200;
    xhrMock.responseText = JSON.stringify({ session_id: "s", files: [] });
    xhrMock.send.mockImplementation(() => {
      xhrMock.upload.onprogress?.({ loaded: 512, total: 1024, lengthComputable: true } as ProgressEvent);
      xhrMock.upload.onprogress?.({ loaded: 1024, total: 1024, lengthComputable: true } as ProgressEvent);
      xhrMock.onload?.call(xhrMock as unknown as XMLHttpRequest);
    });

    const uploadPromise = uploadFiles([makeFile()], ["test.pdf"], undefined, onProgress);

    await uploadPromise;
    expect(onProgress).toHaveBeenCalledWith(512, 1024);
    expect(onProgress).toHaveBeenCalledWith(1024, 1024);
  });

  it("does NOT call onProgress when lengthComputable is false", async () => {
    const onProgress = vi.fn();

    xhrMock.send.mockImplementation(() => {
      xhrMock.upload.onprogress?.({ loaded: 100, total: 0, lengthComputable: false } as ProgressEvent);
      xhrMock.status = 200;
      xhrMock.responseText = JSON.stringify({ session_id: "s", files: [] });
      xhrMock.onload?.call(xhrMock as unknown as XMLHttpRequest);
    });

    await uploadFiles([makeFile()], ["test.pdf"], undefined, onProgress);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("works without an onProgress callback (no crash)", async () => {
    xhrMock.send.mockImplementation(() => {
      xhrMock.upload.onprogress?.({ loaded: 100, total: 200, lengthComputable: true } as ProgressEvent);
      xhrMock.status = 200;
      xhrMock.responseText = JSON.stringify({ session_id: "s", files: [] });
      xhrMock.onload?.call(xhrMock as unknown as XMLHttpRequest);
    });

    await expect(uploadFiles([makeFile()], ["test.pdf"])).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

describe("uploadFiles — error handling", () => {
  it("throws ApiError with kind 'network' on xhr.onerror", async () => {
    xhrMock.send.mockImplementation(() => {
      xhrMock.onerror?.call(xhrMock as unknown as XMLHttpRequest);
    });

    await expect(uploadFiles([makeFile()], ["test.pdf"])).rejects.toMatchObject({
      name: "ApiError",
      kind: "network",
      message: "Network error",
    });
  });

  it("throws ApiError with 'unknown' on xhr.onabort", async () => {
    xhrMock.send.mockImplementation(() => {
      xhrMock.onabort?.call(xhrMock as unknown as XMLHttpRequest);
    });

    await expect(uploadFiles([makeFile()], ["test.pdf"])).rejects.toMatchObject({
      name: "ApiError",
      message: "Upload aborted",
    });
  });

  it("throws ApiError with kind 'network' on xhr.ontimeout", async () => {
    xhrMock.send.mockImplementation(() => {
      xhrMock.ontimeout?.call(xhrMock as unknown as XMLHttpRequest);
    });

    await expect(uploadFiles([makeFile()], ["test.pdf"])).rejects.toMatchObject({
      name: "ApiError",
      kind: "network",
      message: "Upload timed out",
    });
  });

  it("throws ApiError on non-2xx status (413 too_large)", async () => {
    simulateError(413, { code: "too_large", message: "file exceeds 100 MB limit" });

    const err = await uploadFiles([makeFile()], ["test.pdf"]).catch((e: unknown) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(413);
    expect(err.kind).toBe("too_large");
    expect(err.message).toBe("file exceeds 100 MB limit");
  });

  it("throws ApiError on 422 unsupported_format", async () => {
    simulateError(422, { code: "unsupported_format", message: "cannot read this" });

    const err = await uploadFiles([makeFile()], ["test.pdf"]).catch((e: unknown) => e as ApiError);
    expect(err.kind).toBe("unsupported_format");
    expect(err.status).toBe(422);
  });

  it("throws ApiError when response body is invalid JSON", async () => {
    xhrMock.status = 200;
    xhrMock.responseText = "not json";
    xhrMock.send.mockImplementation(() => {
      xhrMock.onload?.call(xhrMock as unknown as XMLHttpRequest);
    });

    await expect(uploadFiles([makeFile()], ["test.pdf"])).rejects.toMatchObject({
      name: "ApiError",
      message: "Invalid upload response",
    });
  });
});

// ---------------------------------------------------------------------------
// AbortSignal
// ---------------------------------------------------------------------------

describe("uploadFiles — AbortSignal", () => {
  it("calls xhr.abort() immediately if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    // send should never be reached if already aborted
    xhrMock.send.mockImplementation(() => {
      // Not reached — abort fires before send in the code
    });

    // The promise rejects because abort fires synchronously
    const uploadPromise = uploadFiles([makeFile()], ["test.pdf"], undefined, undefined, controller.signal);

    // Trigger the internal abort event indirectly
    xhrMock.onabort?.call(xhrMock as unknown as XMLHttpRequest);

    await expect(uploadPromise).rejects.toMatchObject({ name: "ApiError" });
    expect(xhrMock.abort).toHaveBeenCalled();
  });

  it("calls xhr.abort() when signal fires after send", async () => {
    const controller = new AbortController();

    xhrMock.send.mockImplementation(() => {
      // Don't resolve — hang until aborted
    });

    const uploadPromise = uploadFiles([makeFile()], ["test.pdf"], undefined, undefined, controller.signal);

    // Abort while the XHR is in flight
    controller.abort();
    xhrMock.onabort?.call(xhrMock as unknown as XMLHttpRequest);

    await expect(uploadPromise).rejects.toMatchObject({ message: "Upload aborted" });
    expect(xhrMock.abort).toHaveBeenCalled();
  });
});
