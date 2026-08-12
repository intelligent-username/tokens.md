"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { wsUrl } from "./apiBase";
import { markDegraded } from "./useHealth";

export interface ProgressEvent {
  type: "progress";
  job_id: string;
  operation: string;
  current: number;
  total: number;
  file?: string;
  percent?: number;
}

export interface JobDoneEvent {
  type: "job.done";
  job_id: string;
  operation: string;
  summary: unknown;
}

export type JobEvent = ProgressEvent | JobDoneEvent;

const MAX_EVENTS = 500;
const MAX_BACKOFF_MS = 30_000;

/**
 * WebSocket subscription to job progress / completion.
 * subscribe(jobId, sessionId?) opens (or reuses) the session WS, sends a
 * subscribe frame, and returns an unsubscribe. Events for subscribed jobs are
 * appended to `events` and forwarded to onEvent. Reconnects with backoff.
 */
export function useJob(onEvent?: (event: JobEvent) => void): {
  subscribe: (jobId: string, sessionId?: string) => () => void;
  events: JobEvent[];
} {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<string | null>(null);
  const jobsRef = useRef<Set<string>>(new Set());
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const backoffRef = useRef(1000);
  const timerRef = useRef<number | null>(null);

  const connect = useCallback((sessionId: string) => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
    const ws = new WebSocket(wsUrl(sessionId));
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1000;
      jobsRef.current.forEach((jobId) => {
        ws.send(JSON.stringify({ type: "subscribe", job_id: jobId }));
      });
    };

    ws.onmessage = (msg) => {
      try {
        const envelope = JSON.parse(msg.data as string);
        if (envelope.type !== "progress" && envelope.type !== "job.done") return;
        const event = { ...envelope.data, type: envelope.type } as JobEvent;
        if (!jobsRef.current.has(event.job_id)) return;
        setEvents((prev) => [...prev.slice(-(MAX_EVENTS - 1)), event]);
        onEventRef.current?.(event);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
      if (jobsRef.current.size > 0) markDegraded();
      if (timerRef.current !== null) return; // already scheduled
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (sessionRef.current) connect(sessionRef.current);
      }, delay);
    };
  }, []);

  const subscribe = useCallback(
    (jobId: string, sessionId?: string) => {
      if (sessionId) sessionRef.current = sessionId;
      jobsRef.current.add(jobId);
      if (!wsRef.current || wsRef.current.readyState > WebSocket.OPEN) {
        if (sessionRef.current) connect(sessionRef.current);
      } else {
        wsRef.current.send(JSON.stringify({ type: "subscribe", job_id: jobId }));
      }
      return () => {
        jobsRef.current.delete(jobId);
      };
    },
    [connect]
  );

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    },
    []
  );

  return { subscribe, events };
}
