import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWatchStream } from "../useWatchStream";

// Mock the dependencies
vi.mock("../apiBase", () => ({
  fetchJson: vi.fn(),
  wsUrl: vi.fn((sid) => `ws://localhost/api/ws?session_id=${sid}`),
}));

vi.mock("../useHealth", () => ({
  markDegraded: vi.fn(),
}));

vi.mock("../watch/utils", () => ({
  MAX_BACKOFF_MS: 30000,
  MAX_LOG_LINES: 100,
  lineText: vi.fn((kind) => `${kind} message`),
  nextLineId: vi.fn(() => `id-${Date.now()}`),
}));

import { fetchJson, wsUrl } from "../apiBase";
import { markDegraded } from "../useHealth";

// Mock WebSocket globally with instance tracking
const wsInstances: Map<number, { close: ReturnType<typeof vi.fn> }> = new Map();
let wsId = 0;

global.WebSocket = vi.fn().mockImplementation(() => {
  const id = ++wsId;
  const closeFn = vi.fn();
  const instance = {
    readyState: 1, // OPEN
    onopen: null,
    onmessage: null,
    onclose: null,
    send: vi.fn(),
    close: closeFn,
  };
  wsInstances.set(id, { close: closeFn });
  return instance;
}) as any;

describe("useWatchStream", () => {
  const sessionId = "test-session-123";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    wsInstances.clear();
    wsId = 0;
    (fetchJson as any).mockResolvedValue({});
    (wsUrl as any).mockImplementation((sid) => `ws://localhost/api/ws?session_id=${sid}`);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with connecting state when sessionId provided", () => {
    const { result } = renderHook(() => useWatchStream(sessionId));

    expect(result.current.status).toBe("connecting");
    expect(result.current.log).toEqual([]);
    expect(result.current.totals).toBeNull();
  });

  it("initializes with disconnected state when no sessionId", () => {
    const { result } = renderHook(() => useWatchStream(""));

    expect(result.current.status).toBe("disconnected");
    expect(result.current.log).toEqual([]);
    expect(result.current.totals).toBeNull();
  });

  it("sets status to connecting on sessionId change", () => {
    const { result, rerender } = renderHook(
      ({ sid }) => useWatchStream(sid),
      { initialProps: { sid: sessionId } }
    );

    expect(result.current.status).toBe("connecting");

    rerender({ sid: "new-session" });

    expect(result.current.status).toBe("connecting");
  });

  it("restore sets disconnected if not running", async () => {
    (fetchJson as any).mockResolvedValueOnce({ running: false });

    const { result } = renderHook(() => useWatchStream(sessionId));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("disconnected");
  });

  it("restore handles fetch error gracefully", async () => {
    (fetchJson as any).mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() => useWatchStream(sessionId));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("disconnected");
  });

  it("clear resets log and totals", () => {
    const { result } = renderHook(() => useWatchStream(sessionId));

    act(() => {
      result.current.clear();
    });

    expect(result.current.log).toEqual([]);
    expect(result.current.totals).toBeNull();
  });

  it("stop calls API and sets stopped status", async () => {
    (fetchJson as any).mockResolvedValueOnce({});

    const { result } = renderHook(() => useWatchStream(sessionId));

    await act(async () => {
      await result.current.stop();
      await vi.runAllTimersAsync();
    });

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/watch/stop",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
      })
    );
    expect(result.current.status).toBe("stopped");
  });

  it("cleanup on unmount doesn't throw", () => {
    const { unmount } = renderHook(() => useWatchStream(sessionId));

    unmount();

    expect(true).toBe(true);
  });
});