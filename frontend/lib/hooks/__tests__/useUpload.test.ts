import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useUpload } from "../useUpload";

// Helper to create File objects
const createFile = (name: string, size: number): File => {
  const file = new File(["x".repeat(size)], name, { type: "text/plain" });
  return file;
};

describe("useUpload", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with zero progress for empty file list", () => {
    const { result } = renderHook(() => useUpload([]));
    expect(result.current).toBeDefined();
    expect(result.current.progress).toEqual({
      uploaded: 0,
      total: 0,
      percent: 0,
      done: false,
    });
    expect(result.current.perFile).toEqual({});
  });

  it("initializes per-file progress only after upload() is called", () => {
    const files = [createFile("a.txt", 100), createFile("b.txt", 200)];
    const { result } = renderHook(() => useUpload(files));

    // Before upload() is called, perFile is empty
    expect(result.current.perFile).toEqual({});
    expect(result.current.progress).toEqual({
      uploaded: 0,
      total: 2,
      percent: 0,
      done: false,
    });
  });

  it("tracks upload progress via runner callbacks", async () => {
    const files = [createFile("a.txt", 100)];
    const { result } = renderHook(() => useUpload(files));

    await act(async () => {
      await result.current.upload((r) => {
        r.start(0, 100);
        r.advance(0, 50);
        r.advance(0, 100);
      });
    });

    await vi.runAllTimersAsync();

    expect(result.current.perFile[0]).toEqual({
      name: "a.txt",
      totalBytes: 100,
      uploadedBytes: 100,
      percent: 100,
      done: true,
    });
    expect(result.current.progress).toEqual({
      uploaded: 1,
      total: 1,
      percent: 100,
      done: true,
    });
  });

  it("handles file failure correctly", async () => {
    const files = [createFile("a.txt", 100)];
    const { result } = renderHook(() => useUpload(files));

    await act(async () => {
      await result.current.upload((r) => {
        r.start(0, 100);
        r.fail(0, "network error");
      });
    });

    expect(result.current.perFile[0]).toMatchObject({
      name: "a.txt",
      failed: "network error",
      done: false,
    });
    expect(result.current.progress.done).toBe(true);
  });
});