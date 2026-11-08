import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWorkspaceState } from "../useWorkspaceState";

const createFile = (name: string, size: number): File => {
  return new File(["x".repeat(size)], name, { type: "text/plain" });
};

describe("useWorkspaceState - state derivation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'empty' for empty queue", () => {
    const { result } = renderHook(() => useWorkspaceState([]));
    expect(result.current.state).toBe("empty");
  });

  it("returns 'idle' for all queued items", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100), createFile("b.txt", 200)]));
    expect(result.current.state).toBe("idle");
  });

  it("returns 'uploading' if any item is uploading", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100)]));
    act(() => {
      result.current.run();
    });
    expect(result.current.state).toBe("uploading");
  });

  it("returns 'processing' if any item is converting and no uploading", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100), createFile("b.txt", 200)]));
    act(() => {
      result.current.run();
    });
    // Manually set one to converting, none uploading
    act(() => {
      result.current.setQueue([
        { id: "1", file: createFile("a.txt", 100), name: "a.txt", size: 100, status: "converting" },
        { id: "2", file: createFile("b.txt", 200), name: "b.txt", size: 200, status: "queued" },
      ]);
    });
    expect(result.current.state).toBe("processing");
  });

  it("returns 'error' if all items failed", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100)]));
    act(() => {
      result.current.setQueue([{ id: "1", file: createFile("a.txt", 100), name: "a.txt", size: 100, status: "failed", error: "oops" }]);
    });
    expect(result.current.state).toBe("error");
  });

  it("returns 'partial-failure' if some failed and some done", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100), createFile("b.txt", 200)]));
    act(() => {
      result.current.setQueue([
        { id: "1", file: createFile("a.txt", 100), name: "a.txt", size: 100, status: "failed", error: "oops" },
        { id: "2", file: createFile("b.txt", 200), name: "b.txt", size: 200, status: "done" },
      ]);
    });
    expect(result.current.state).toBe("partial-failure");
  });

  it("returns 'success' if all items done", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100), createFile("b.txt", 200)]));
    act(() => {
      result.current.setQueue([
        { id: "1", file: createFile("a.txt", 100), name: "a.txt", size: 100, status: "done" },
        { id: "2", file: createFile("b.txt", 200), name: "b.txt", size: 200, status: "done" },
      ]);
    });
    expect(result.current.state).toBe("success");
  });

  it("returns 'cancelled' if any item cancelled", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100), createFile("b.txt", 200)]));
    act(() => {
      result.current.setQueue([
        { id: "1", file: createFile("a.txt", 100), name: "a.txt", size: 100, status: "cancelled" },
        { id: "2", file: createFile("b.txt", 200), name: "b.txt", size: 200, status: "done" },
      ]);
    });
    expect(result.current.state).toBe("cancelled");
  });
});

describe("useWorkspaceState - hook behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with files converted to queue items", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100), createFile("b.txt", 200)]));
    expect(result.current.queue).toHaveLength(2);
    expect(result.current.queue[0].name).toBe("a.txt");
    expect(result.current.queue[1].name).toBe("b.txt");
    expect(result.current.queue[0].status).toBe("queued");
    expect(result.current.state).toBe("idle");
  });

  it("initializes empty state for empty file list", () => {
    const { result } = renderHook(() => useWorkspaceState([]));
    expect(result.current.queue).toEqual([]);
    expect(result.current.state).toBe("empty");
  });

  it("setQueue replaces queue with new files", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100)]));
    act(() => {
      result.current.setQueue([createFile("b.txt", 200), createFile("c.txt", 300)]);
    });
    expect(result.current.queue).toHaveLength(2);
    expect(result.current.queue[0].name).toBe("b.txt");
    expect(result.current.queue[1].name).toBe("c.txt");
  });

  it("setQueue accepts QueueItem array directly", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100)]));
    act(() => {
      result.current.setQueue([{ id: "1", file: createFile("direct.txt", 100), name: "direct.txt", size: 100, status: "done" }]);
    });
    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].name).toBe("direct.txt");
    expect(result.current.queue[0].status).toBe("done");
  });

  it("run transitions queued and failed items to uploading", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100), createFile("b.txt", 200)]));
    act(() => {
      result.current.run();
    });
    expect(result.current.queue[0].status).toBe("uploading");
    expect(result.current.queue[1].status).toBe("uploading");
    expect(result.current.state).toBe("uploading");
  });

  it("run calls onRun handler with active items", () => {
    const onRun = vi.fn();
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100)], { onRun }));
    act(() => {
      result.current.run();
    });
    expect(onRun).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: "a.txt", status: "uploading" }),
      ])
    );
  });

  it("cancel transitions active items to cancelled", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100)]));
    act(() => {
      result.current.run();
      result.current.cancel();
    });
    expect(result.current.queue[0].status).toBe("cancelled");
    expect(result.current.state).toBe("cancelled");
  });

  it("cancel calls onCancel handler", () => {
    const onCancel = vi.fn();
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100)], { onCancel }));
    act(() => {
      result.current.run();
      result.current.cancel();
    });
    expect(onCancel).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ status: "cancelled" }),
      ])
    );
  });

  it("retryFailed transitions failed items back to uploading", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100), createFile("b.txt", 200)]));
    act(() => {
      result.current.setQueue([
        { id: "1", file: createFile("a.txt", 100), name: "a.txt", size: 100, status: "failed", error: "oops" },
        { id: "2", file: createFile("b.txt", 200), name: "b.txt", size: 200, status: "done" },
      ]);
    });
    expect(result.current.queue[0].status).toBe("failed");
    act(() => {
      result.current.retryFailed();
    });
    expect(result.current.queue[0].status).toBe("uploading");
    expect(result.current.queue[0].error).toBeUndefined();
    expect(result.current.queue[1].status).toBe("done");
  });

  it("retryFailed calls onRetry handler with retried items", () => {
    const onRetry = vi.fn();
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100)], { onRetry }));
    act(() => {
      result.current.setQueue([{ id: "1", file: createFile("a.txt", 100), name: "a.txt", size: 100, status: "failed", error: "oops" }]);
    });
    // Wait for state update
    act(() => {
      // Force re-render
    });
    act(() => {
      result.current.retryFailed();
    });
    expect(onRetry).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: "a.txt", status: "uploading" }),
      ])
    );
  });

  it("state derives correctly after each transition", () => {
    const { result } = renderHook(() => useWorkspaceState([createFile("a.txt", 100), createFile("b.txt", 200)]));
    expect(result.current.state).toBe("idle");
    act(() => { result.current.run(); });
    expect(result.current.state).toBe("uploading");
    act(() => {
      result.current.setQueue([
        { id: "1", file: createFile("a.txt", 100), name: "a.txt", size: 100, status: "converting" },
        { id: "2", file: createFile("b.txt", 200), name: "b.txt", size: 200, status: "queued" },
      ]);
    });
    expect(result.current.state).toBe("processing");
    act(() => {
      result.current.setQueue([
        { id: "1", file: createFile("a.txt", 100), name: "a.txt", size: 100, status: "done" },
        { id: "2", file: createFile("b.txt", 200), name: "b.txt", size: 200, status: "done" },
      ]);
    });
    expect(result.current.state).toBe("success");
  });
});