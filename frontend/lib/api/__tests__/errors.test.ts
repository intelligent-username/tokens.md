/**
 * Tests for lib/errors.ts
 *
 * Covers: classifyError() — all 7 recognised kinds + fallback
 *         triageError()   — level, message, nextStep for every ErrorKind,
 *                           custom message override, file-parameter handling
 */
import { describe, expect, it } from "vitest";
import { classifyError, triageError } from "../../errors";

// ---------------------------------------------------------------------------
// classifyError
// ---------------------------------------------------------------------------

describe("classifyError", () => {
  // Known backend error codes (exact strings from constants.py)
  it("classifies 'unsupported_format' code", () => {
    expect(classifyError("unsupported_format")).toBe("unsupported_format");
  });

  it("classifies 'UnsupportedFormatError' class name (case-insensitive)", () => {
    expect(classifyError("UnsupportedFormatError")).toBe("unsupported_format");
  });

  it("classifies 'missing_dependency'", () => {
    expect(classifyError("missingdependency")).toBe("missing_dependency");
    expect(classifyError("MissingDependencyError")).toBe("missing_dependency");
  });

  it("classifies 'too_large' via 'toolarge' substring", () => {
    expect(classifyError("too_large")).toBe("too_large");
    expect(classifyError("toolarge")).toBe("too_large");
  });

  it("classifies 'too_large' via 'payload' substring", () => {
    expect(classifyError("payload_too_large")).toBe("too_large");
  });

  it("classifies 'not_found' via 'notfound' substring", () => {
    expect(classifyError("not_found")).toBe("not_found");
    expect(classifyError("NotFoundError")).toBe("not_found");
  });

  it("classifies 'not_found' via 'disappeared' substring", () => {
    expect(classifyError("file_disappeared")).toBe("not_found");
  });

  it("classifies 'network' via 'network' substring", () => {
    expect(classifyError("network")).toBe("network");
    expect(classifyError("NetworkError")).toBe("network");
  });

  it("classifies 'network' via 'connection' substring", () => {
    expect(classifyError("connection_refused")).toBe("network");
  });

  it("classifies 'clipboard_blocked' via 'clipboard' substring", () => {
    expect(classifyError("clipboard")).toBe("clipboard_blocked");
    expect(classifyError("ClipboardError")).toBe("clipboard_blocked");
  });

  it("classifies 'budget_cannot_fit' via 'budget' substring", () => {
    expect(classifyError("budget")).toBe("budget_cannot_fit");
    expect(classifyError("budget_exceeded")).toBe("budget_cannot_fit");
  });

  it("classifies 'budget_cannot_fit' via 'cannotfit' substring", () => {
    expect(classifyError("cannotfit")).toBe("budget_cannot_fit");
  });

  it("returns 'unknown' for unrecognised strings", () => {
    expect(classifyError("some_random_code")).toBe("unknown");
    expect(classifyError("")).toBe("unknown");
    expect(classifyError("bad_request")).toBe("unknown");
    expect(classifyError("local_paths_disabled")).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// triageError — level mapping
// ---------------------------------------------------------------------------

describe("triageError — error level mapping", () => {
  it("maps 'unsupported_format' → level 'row'", () => {
    expect(triageError("unsupported_format").level).toBe("row");
  });

  it("maps 'missing_dependency' → level 'banner'", () => {
    expect(triageError("missing_dependency").level).toBe("banner");
  });

  it("maps 'too_large' → level 'toast'", () => {
    expect(triageError("too_large").level).toBe("toast");
  });

  it("maps 'not_found' → level 'row'", () => {
    expect(triageError("not_found").level).toBe("row");
  });

  it("maps 'network' → level 'toast'", () => {
    expect(triageError("network").level).toBe("toast");
  });

  it("maps 'clipboard_blocked' → level 'inline'", () => {
    expect(triageError("clipboard_blocked").level).toBe("inline");
  });

  it("maps 'budget_cannot_fit' → level 'inline'", () => {
    expect(triageError("budget_cannot_fit").level).toBe("inline");
  });

  it("maps 'unknown' → level 'row'", () => {
    expect(triageError("unknown").level).toBe("row");
  });
});

// ---------------------------------------------------------------------------
// triageError — custom message override
// ---------------------------------------------------------------------------

describe("triageError — custom message override", () => {
  it("uses the provided message instead of the default copy", () => {
    const result = triageError("unsupported_format", "Server says: nope");
    expect(result.message).toBe("Server says: nope");
  });

  it("uses the provided message for 'network'", () => {
    const result = triageError("network", "Custom network error");
    expect(result.message).toBe("Custom network error");
  });

  it("uses the provided message for 'unknown'", () => {
    const result = triageError("unknown", "Something weird happened");
    expect(result.message).toBe("Something weird happened");
  });
});

// ---------------------------------------------------------------------------
// triageError — default copy strings (no custom message)
// ---------------------------------------------------------------------------

describe("triageError — default copy strings", () => {
  it("returns a non-empty default message for every kind", () => {
    const kinds = ["unsupported_format", "missing_dependency", "too_large", "not_found", "network", "clipboard_blocked", "budget_cannot_fit", "unknown"] as const;
    for (const kind of kinds) {
      const result = triageError(kind);
      expect(result.message.length, `${kind} should have a non-empty message`).toBeGreaterThan(0);
      expect(result.nextStep.length, `${kind} should have a non-empty nextStep`).toBeGreaterThan(0);
    }
  });

  it("uses file-specific message for 'not_found' when file is provided", () => {
    const withFile = triageError("not_found", undefined, "doc.pdf");
    const withoutFile = triageError("not_found");
    // Both should be strings but the file-specific version differs from the default
    expect(typeof withFile.message).toBe("string");
    expect(withFile.message).not.toBe(withoutFile.message);
  });

  it("uses format-specific message for 'unsupported_format' when file is provided", () => {
    const result = triageError("unsupported_format", undefined, ".xyz");
    expect(result.message).toContain(".xyz");
  });

  it("uses {name} placeholder for 'unknown' when no file given", () => {
    const result = triageError("unknown");
    expect(result.message).toContain("{name}");
  });

  it("interpolates actual file name for 'unknown' when file is provided", () => {
    const result = triageError("unknown", undefined, "broken.doc");
    expect(result.message).toContain("broken.doc");
    expect(result.message).not.toContain("{name}");
  });
});

// ---------------------------------------------------------------------------
// triageError — nextStep strings are non-empty for all kinds
// ---------------------------------------------------------------------------

describe("triageError — nextStep strings", () => {
  it("returns nextStep 'Remove it and convert the rest.' for unsupported_format", () => {
    expect(triageError("unsupported_format").nextStep).toBe("Remove it and convert the rest.");
  });

  it("returns nextStep 'Retry after reinstall.' for missing_dependency", () => {
    expect(triageError("missing_dependency").nextStep).toBe("Retry after reinstall.");
  });

  it("returns nextStep 'Raise the ceiling.' for budget_cannot_fit", () => {
    expect(triageError("budget_cannot_fit").nextStep).toBe("Raise the ceiling.");
  });

  it("returns nextStep 'Copy manually.' for clipboard_blocked", () => {
    expect(triageError("clipboard_blocked").nextStep).toBe("Copy manually.");
  });
});
