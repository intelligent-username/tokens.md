/**
 * End-to-End Workflow Test: Watch & Realtime Streaming Pipeline
 *
 * Exercises the watcher lifecycle:
 * 1. Initializing watcher daemon for an input directory.
 * 2. Connecting WebSocket stream and subscribing to real-time events.
 * 3. Handling file added/modified events.
 * 4. Polling watch status and cleanly terminating the watcher session.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchStart, watchStatus, watchStop } from "@/lib/api/endpoints";
import { createWs } from "@/lib/api/ws";
import type { WsMessage } from "@/lib/api/types";

describe("E2E Watcher & Streaming Pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("orchestrates watch lifecycle: start -> ws event dispatch -> status -> stop", async () => {
    const sessionId = "watch-session-303";
    const events: WsMessage[] = [];

    // Mock REST endpoints
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/watch/start")) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ watch_id: "w_123", source_dir: "inbox/", running: true }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      if (url.includes(`/api/watch/${sessionId}`)) {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              watch_id: "w_123",
              running: true,
              converted_count: 3,
              total_source_tokens: 4500,
              total_target_tokens: 1200,
            }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      if (url.includes("/api/watch/stop")) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true, watch_id: "w_123", running: false }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    // Mock WebSocket for realtime event stream
    let currentSocket: MockSocket | null = null;

    class MockSocket {
      readyState = 1; // OPEN
      onopen: (() => void) | null = null;
      onmessage: ((ev: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      send = vi.fn();
      close = vi.fn(() => this.onclose?.());

      constructor() {
        currentSocket = this;
        setTimeout(() => this.onopen?.(), 5);
      }
    }

    vi.stubGlobal("WebSocket", MockSocket);

    // 1. Start Watcher
    const startRes = await watchStart({
      session_id: sessionId,
      source_dir: "inbox/",
      options: { budget: 2000, recursive: true },
    });
    expect(startRes.running).toBe(true);

    // 2. Connect WebSocket and subscribe
    const ws = createWs(sessionId);
    ws.connect();
    const unsubscribe = ws.subscribe((msg) => {
      events.push(msg as unknown as WsMessage);
    });

    // Simulate incoming stream events
    currentSocket?.onmessage?.({
      data: JSON.stringify({ type: "watch_event", path: "inbox/doc1.pdf", status: "converted", source_tokens: 1200, target_tokens: 300 }),
    });
    currentSocket?.onmessage?.({
      data: JSON.stringify({ type: "watch_event", path: "inbox/doc2.docx", status: "converted", source_tokens: 3300, target_tokens: 900 }),
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ status: "converted", path: "inbox/doc1.pdf" });

    // 3. Query watcher status
    const statusRes = await watchStatus(sessionId);
    expect(statusRes.running).toBe(true);
    expect(statusRes.converted_count).toBe(3);

    // 4. Terminate watcher session
    const stopRes = await watchStop(sessionId);
    expect(stopRes.running).toBe(false);

    unsubscribe();
    ws.close();
  });
});
