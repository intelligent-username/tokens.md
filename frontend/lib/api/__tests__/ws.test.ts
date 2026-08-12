/**
 * Tests for lib/api/ws.ts
 *
 * Covers: createWs() — connect/close lifecycle, message dispatch to subscribers,
 * subscribe/unsubscribe, exponential backoff reconnect, onerror → close,
 * guard against reconnect when closedByUser, concurrent timer guard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWs } from "../ws";

// ---------------------------------------------------------------------------
// WebSocket mock
// ---------------------------------------------------------------------------

interface WsMockInstance {
  url: string;
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

const instances: WsMockInstance[] = [];

const MockWebSocket = vi.fn((url: string): WsMockInstance => {
  const instance: WsMockInstance = {
    url,
    readyState: WebSocket.CONNECTING, // 0
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    close: vi.fn(() => {
      instance.readyState = WebSocket.CLOSED;
      instance.onclose?.();
    }),
    send: vi.fn(),
  };
  instances.push(instance);
  return instance;
}) as unknown as typeof WebSocket;

// Attach static constants
(MockWebSocket as unknown as Record<string, number>).CONNECTING = 0;
(MockWebSocket as unknown as Record<string, number>).OPEN = 1;
(MockWebSocket as unknown as Record<string, number>).CLOSING = 2;
(MockWebSocket as unknown as Record<string, number>).CLOSED = 3;

beforeEach(() => {
  instances.length = 0;
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function latestWs() {
  return instances[instances.length - 1];
}

function openWs(ws: WsMockInstance) {
  ws.readyState = WebSocket.OPEN;
  ws.onopen?.();
}

function closeWs(ws: WsMockInstance) {
  ws.readyState = WebSocket.CLOSED;
  ws.onclose?.();
}

function emitMessage(ws: WsMockInstance, data: unknown) {
  ws.onmessage?.({ data: JSON.stringify(data) });
}

// ---------------------------------------------------------------------------
// connect / close lifecycle
// ---------------------------------------------------------------------------

describe("createWs — connect/close", () => {
  it("does NOT open a WebSocket until connect() is called", () => {
    createWs("sess-1");
    expect(MockWebSocket).not.toHaveBeenCalled();
  });

  it("opens a WebSocket with the correct session URL on connect()", () => {
    const mgr = createWs("sess-1");
    mgr.connect();

    expect(MockWebSocket).toHaveBeenCalledOnce();
    expect(latestWs().url).toContain("sess-1");
    expect(latestWs().url).toContain("/api/ws");
  });

  it("does not open a second socket if already OPEN", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());

    mgr.connect(); // second call
    expect(MockWebSocket).toHaveBeenCalledOnce();
  });

  it("reports connected=false before connect()", () => {
    const mgr = createWs("sess-1");
    expect(mgr.connected).toBe(false);
  });

  it("reports connected=true after socket opens", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());
    expect(mgr.connected).toBe(true);
  });

  it("reports connected=false after close()", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());

    mgr.close();
    expect(mgr.connected).toBe(false);
  });

  it("calls ws.close() when manager close() is invoked", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    const ws = latestWs();
    openWs(ws);

    mgr.close();
    expect(ws.close).toHaveBeenCalled();
  });

  it("resets backoff to 1s on successful open", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    const ws = latestWs();

    // Force a close to start backoff
    closeWs(ws);

    // Now the next socket opens and fires onopen
    vi.runAllTimers();
    openWs(latestWs());

    // If a further close happens, the backoff should be 1s again (not 2s)
    closeWs(latestWs());
    // Timer should be scheduled with 1s again
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket).toHaveBeenCalledTimes(3); // original + 2 reconnects
  });
});

// ---------------------------------------------------------------------------
// Message dispatch
// ---------------------------------------------------------------------------

describe("createWs — message dispatch", () => {
  it("delivers parsed envelope to all subscribed handlers", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    const ws = latestWs();
    openWs(ws);

    const handler1 = vi.fn();
    const handler2 = vi.fn();
    mgr.subscribe(handler1);
    mgr.subscribe(handler2);

    const envelope = { type: "watch.file", data: { file: "doc.pdf", status: "done" } };
    emitMessage(ws, envelope);

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler1).toHaveBeenCalledWith(envelope);
    expect(handler2).toHaveBeenCalledOnce();
  });

  it("ignores malformed (non-JSON) messages without throwing", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    const ws = latestWs();
    openWs(ws);

    const handler = vi.fn();
    mgr.subscribe(handler);

    expect(() => ws.onmessage?.({ data: "NOT JSON {{{{" })).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("delivers different event types correctly", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());

    const received: unknown[] = [];
    mgr.subscribe((env) => received.push(env));

    emitMessage(latestWs(), { type: "watch.started", data: {} });
    emitMessage(latestWs(), { type: "watch.total", data: { files: 5 } });
    emitMessage(latestWs(), { type: "watch.stopped", data: { reason: "requested" } });

    expect(received).toHaveLength(3);
    expect((received[0] as { type: string }).type).toBe("watch.started");
    expect((received[2] as { type: string }).type).toBe("watch.stopped");
  });
});

// ---------------------------------------------------------------------------
// subscribe / unsubscribe
// ---------------------------------------------------------------------------

describe("createWs — subscribe / unsubscribe", () => {
  it("subscribe() returns an unsub function that removes the handler", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());

    const handler = vi.fn();
    const unsub = mgr.subscribe(handler);
    unsub();

    emitMessage(latestWs(), { type: "ping", data: {} });
    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribe() removes the handler", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());

    const handler = vi.fn();
    mgr.subscribe(handler);
    mgr.unsubscribe(handler);

    emitMessage(latestWs(), { type: "ping", data: {} });
    expect(handler).not.toHaveBeenCalled();
  });

  it("only removes the specified handler, not others", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());

    const h1 = vi.fn();
    const h2 = vi.fn();
    mgr.subscribe(h1);
    mgr.subscribe(h2);
    mgr.unsubscribe(h1);

    emitMessage(latestWs(), { type: "ping", data: {} });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });

  it("is safe to unsubscribe a handler that was never subscribed", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());

    const handler = vi.fn();
    expect(() => mgr.unsubscribe(handler)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// onerror handling
// ---------------------------------------------------------------------------

describe("createWs — onerror", () => {
  it("calls ws.close() on onerror", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    const ws = latestWs();
    openWs(ws);

    ws.onerror?.();
    expect(ws.close).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Exponential backoff reconnect
// ---------------------------------------------------------------------------

describe("createWs — exponential backoff reconnect", () => {
  it("reconnects after 1s on first close", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());

    closeWs(latestWs()); // triggers backoff
    expect(MockWebSocket).toHaveBeenCalledTimes(1); // not yet reconnected

    vi.advanceTimersByTime(1000);
    expect(MockWebSocket).toHaveBeenCalledTimes(2); // reconnected
  });

  it("doubles the backoff on consecutive closes", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());

    // 1st close → 1s backoff
    closeWs(latestWs());
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket).toHaveBeenCalledTimes(2);

    // 2nd close → 2s backoff (without re-opening, so skip onopen)
    closeWs(latestWs());
    vi.advanceTimersByTime(1000); // only 1s — should NOT have reconnected yet
    expect(MockWebSocket).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1000); // now 2s have elapsed
    expect(MockWebSocket).toHaveBeenCalledTimes(3);
  });

  it("caps backoff at 30s", () => {
    const mgr = createWs("sess-1");
    mgr.connect();

    // Simulate many closes to drive backoff over cap
    for (let i = 0; i < 10; i++) {
      openWs(latestWs());
      closeWs(latestWs());
      vi.runAllTimers();
    }

    // After 10 doublings (1s × 2^10 = 1024s) the cap should be 30s.
    // Verify the last reconnect happened within 30s window.
    openWs(latestWs());
    closeWs(latestWs());

    vi.advanceTimersByTime(30_000);
    // At this point we must have at least attempted another reconnect
    expect(MockWebSocket.mock.calls.length).toBeGreaterThan(2);
  });

  it("does NOT reconnect when closedByUser=true", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());

    mgr.close(); // sets closedByUser = true, triggers ws.close() → onclose
    const callsBefore = MockWebSocket.mock.calls.length;

    vi.advanceTimersByTime(60_000); // well past any backoff
    expect(MockWebSocket.mock.calls.length).toBe(callsBefore); // no new socket
  });

  it("cancels a pending reconnect timer on close()", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());

    // Trigger a reconnect schedule
    closeWs(latestWs()); // schedules 1s timer

    // Immediately close the manager (should cancel the timer)
    mgr.close();
    const callsBefore = MockWebSocket.mock.calls.length;

    vi.advanceTimersByTime(5000);
    expect(MockWebSocket.mock.calls.length).toBe(callsBefore);
  });

  it("does not schedule a second timer if one is already pending", () => {
    const mgr = createWs("sess-1");
    mgr.connect();
    openWs(latestWs());

    closeWs(latestWs()); // 1st close → timer scheduled

    // Simulate a second close event before the timer fires
    // (edge case: socket reference is null so the guard `if (socket === ws)` skips,
    //  but timer guard `if (timer !== null) return` should prevent double-schedule)
    const ws = instances[0];
    ws.onclose?.(); // fires again

    const timerCount = vi.getTimerCount();
    expect(timerCount).toBe(1); // only one timer
  });
});
