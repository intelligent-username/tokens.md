/**
 * WebSocket manager for a session. Auto-reconnects with exponential backoff.
 * URL comes from wsUrl(sessionId) in lib/hooks/apiBase.ts (B4).
 */

import { wsUrl } from "@/lib/hooks/apiBase";
import type { WsEnvelope } from "./types";

export type WsHandler = (envelope: WsEnvelope) => void;

export interface WsManager {
  connect: () => void;
  close: () => void;
  subscribe: (handler: WsHandler) => () => void;
  unsubscribe: (handler: WsHandler) => void;
  readonly connected: boolean;
}

const MAX_BACKOFF_MS = 30_000;

/** Create a WebSocket manager for a session. Nothing connects until connect(). */
export function createWs(sessionId: string): WsManager {
  let socket: WebSocket | null = null;
  let closedByUser = false;
  let timer: number | null = null;
  let backoff = 1000;
  const handlers = new Set<WsHandler>();

  const open = () => {
    if (socket && socket.readyState <= WebSocket.OPEN) return;
    const ws = new WebSocket(wsUrl(sessionId));
    socket = ws;

    ws.onopen = () => {
      backoff = 1000;
    };

    ws.onmessage = (msg) => {
      let envelope: WsEnvelope;
      try {
        envelope = JSON.parse(msg.data as string) as WsEnvelope;
      } catch {
        return;
      }
      handlers.forEach((handler) => handler(envelope));
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onclose = () => {
      if (socket === ws) socket = null;
      if (closedByUser || timer !== null) return;
      const delay = backoff;
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      timer = window.setTimeout(() => {
        timer = null;
        open();
      }, delay);
    };
  };

  return {
    connect: () => {
      closedByUser = false;
      open();
    },
    close: () => {
      closedByUser = true;
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      socket?.close();
      socket = null;
    },
    subscribe: (handler) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    unsubscribe: (handler) => {
      handlers.delete(handler);
    },
    get connected() {
      return socket !== null && socket.readyState === WebSocket.OPEN;
    },
  };
}
