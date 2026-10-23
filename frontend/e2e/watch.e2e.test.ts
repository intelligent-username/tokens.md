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
import type { WsEnvelope } from "@/lib/api/types";

describe("E2E Watcher & Streaming Pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("orchestrates watch lifecycle: start -> ws event dispatch -> status -> stop", async () => {
    const sessionId = "watch-session-303";
    const events: WsEnvelope[] = [];

    // Mock REST endpoints
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/watch/start")) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ watch_id: "w_123", source: "inbox/", output: "outbox/" }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      if (url.includes(`/api/watch/${sessionId}`)) {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              running: true,
              files_processed: 3,
              source_tokens: 4500,
              target_tokens: 1200,
            }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      if (url.includes("/api/watch/stop")) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ stopped: true }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    // Mock WebSocket for realtime event stream
    // Cast stops TS narrowing this to `null`; it is only assigned inside the constructor.
    let currentSocket = null as MockSocket | null;

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
      options: { poll_interval: 1, once: false },
    });
    expect(startRes.watch_id).toBe("w_123");

    // 2. Connect WebSocket and subscribe
    const ws = createWs(sessionId);
    ws.connect();
    const unsubscribe = ws.subscribe((msg) => {
      events.push(msg);
    });

    // Simulate incoming stream events
    currentSocket?.onmessage?.({
      data: JSON.stringify({ type: "watch.file", data: { file: "inbox/doc1.pdf", status: "done", source_tokens: 1200, target_tokens: 300 } }),
    });
    currentSocket?.onmessage?.({
      data: JSON.stringify({ type: "watch.file", data: { file: "inbox/doc2.docx", status: "done", source_tokens: 3300, target_tokens: 900 } }),
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: "watch.file", data: { status: "done", file: "inbox/doc1.pdf" } });

    // 3. Query watcher status
    const statusRes = await watchStatus(sessionId);
    expect(statusRes.running).toBe(true);
    expect(statusRes.files_processed).toBe(3);

    // 4. Terminate watcher session
    const stopRes = await watchStop(sessionId);
    expect(stopRes.stopped).toBe(true);

    unsubscribe();
    ws.close();
  });
});
