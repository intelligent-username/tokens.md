'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson, wsUrl } from './apiBase';
import { markDegraded } from './useHealth';

export type WatchStatus =
  | 'disconnected'
  | 'connecting'
  | 'watching'
  | 'reconnecting'
  | 'stopping'
  | 'stopped';

export type WatchLineKind =
  | 'started'
  | 'queued'
  | 'converting'
  | 'done'
  | 'skipped'
  | 'error'
  | 'stopped';

export interface WatchLogLine {
  id: string;
  kind: WatchLineKind;
  text: string;
  file?: string;
  sourceTokens?: number;
  targetTokens?: number;
  percent?: number;
  error?: string;
  ts: number;
}

export interface WatchTotals {
  files: number;
  source_tokens: number;
  target_tokens: number;
  percent: number;
  files_processed: number;
}

export interface WatchStartOptions {
  poll_interval?: number;
  extensions?: string[];
  once?: boolean;
  convert_opts?: Record<string, unknown>;
}

interface WatchStatusResponse {
  running: boolean;
  started_at?: string;
  source?: string;
  output?: string;
  files_processed?: number;
  source_tokens?: number;
  target_tokens?: number;
}

const MAX_LOG_LINES = 1000;
const MAX_BACKOFF_MS = 30_000;

let watchSeq = 0;
const nextLineId = () => `watch-${++watchSeq}`;

const fmtTokens = (n?: number) =>
  n === undefined ? '' : new Intl.NumberFormat('en-US').format(n);
const fmtPercent = (p?: number) =>
  p === undefined ? '' : `${p >= 0 ? '−' : ''}${Math.abs(p)}%`;

function lineText(
  kind: WatchLineKind,
  data: Record<string, unknown>,
): string {
  const file = String(data.file ?? '');
  switch (kind) {
    case 'started':
      return `${String(data.source ?? '')} → ${String(data.output ?? '')}`;
    case 'queued':
      return `queued ${file}`;
    case 'converting':
      return `converting ${file}`;
    case 'done':
      return `converted ${file} → ${fmtTokens(data.source_tokens as number)} → ${fmtTokens(
        data.target_tokens as number,
      )} · ${fmtPercent(data.percent as number)}`;
    case 'skipped':
      return `skipped ${file}${data.error ? ` — ${String(data.error)}` : ''}`;
    case 'error':
      return `failed ${file}${data.error ? ` — ${String(data.error)}` : ''}`;
    case 'stopped':
      return `stopped${data.reason ? ` — ${String(data.reason)}` : ''}`;
    default:
      return file;
  }
}

/**
 * Watch stream: WS /api/ws?session_id + GET /api/watch/{sid} status restore.
 * Reconnects with backoff; while disconnected the daemon keeps running
 * server-side. watch.total events are accumulated defensively (absolute if the
 * count grows, additive otherwise).
 */
export function useWatchStream(sessionId: string): {
  status: WatchStatus;
  log: WatchLogLine[];
  totals: WatchTotals | null;
  start: (options?: WatchStartOptions) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
} {
  const [status, setStatus] = useState<WatchStatus>('disconnected');
  const [log, setLog] = useState<WatchLogLine[]>([]);
  const [totals, setTotals] = useState<WatchTotals | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const intentRef = useRef<{ stopping: boolean }>({ stopping: false });
  const backoffRef = useRef(1000);
  const timerRef = useRef<number | null>(null);

  const append = useCallback((kind: WatchLineKind, text: string, data?: Record<string, unknown>) => {
    setLog((prev) => [
      ...prev.slice(-(MAX_LOG_LINES - 1)),
      {
        id: nextLineId(),
        kind,
        text,
        file: data?.file ? String(data.file) : undefined,
        sourceTokens: data?.source_tokens as number | undefined,
        targetTokens: data?.target_tokens as number | undefined,
        percent: data?.percent as number | undefined,
        error: data?.error ? String(data.error) : undefined,
        ts: Date.now(),
      },
    ]);
  }, []);

  const applyTotals = useCallback((data: Record<string, unknown>) => {
    setTotals((prev) => {
      const files = Number(data.files ?? 0);
      const sourceTokens = Number(data.source_tokens ?? 0);
      const targetTokens = Number(data.target_tokens ?? 0);
      const filesProcessed = Number(data.files_processed ?? 0);
      const isAbsolute = !prev || files > prev.files;
      return {
        files: isAbsolute ? files : (prev?.files ?? 0) + files,
        source_tokens: isAbsolute
          ? sourceTokens
          : (prev?.source_tokens ?? 0) + sourceTokens,
        target_tokens: isAbsolute
          ? targetTokens
          : (prev?.target_tokens ?? 0) + targetTokens,
        percent: Number(data.percent ?? 0),
        files_processed: filesProcessed || (prev?.files_processed ?? 0),
      };
    });
  }, []);

  const openSocket = useCallback(
    (sid: string) => {
      if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
      const ws = new WebSocket(wsUrl(sid));
      wsRef.current = ws;

      ws.onopen = () => {
        backoffRef.current = 1000;
        setStatus((prev) =>
          prev === 'stopping' ? prev : 'watching',
        );
      };

      ws.onmessage = (msg) => {
        try {
          const envelope = JSON.parse(msg.data as string);
          const data = (envelope.data ?? {}) as Record<string, unknown>;
          switch (envelope.type) {
            case 'watch.started':
              append('started', lineText('started', data), data);
              break;
            case 'watch.file': {
              const fileStatus = String(data.status ?? '');
              const kind: WatchLineKind =
                fileStatus === 'queued'
                  ? 'queued'
                  : fileStatus === 'converting'
                    ? 'converting'
                    : fileStatus === 'done'
                      ? 'done'
                      : fileStatus === 'skipped'
                        ? 'skipped'
                        : 'error';
              append(kind, lineText(kind, data), data);
              break;
            }
            case 'watch.total':
              applyTotals(data);
              break;
            case 'watch.stopped':
              append('stopped', lineText('stopped', data), data);
              setStatus('stopped');
              break;
            default:
              break;
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (intentRef.current.stopping) return;
        setStatus('reconnecting');
        markDegraded();
        if (timerRef.current !== null) return; // already scheduled
        const delay = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          if (!intentRef.current.stopping && sessionId) openSocket(sessionId);
        }, delay);
      };
    },
    [append, applyTotals, sessionId],
  );

  const restore = useCallback(async () => {
    try {
      const state = await fetchJson<WatchStatusResponse>(`/api/watch/${sessionId}`);
      if (state.running) {
        setTotals((prev) => ({
          files: state.files_processed ?? prev?.files ?? 0,
          source_tokens: state.source_tokens ?? prev?.source_tokens ?? 0,
          target_tokens: state.target_tokens ?? prev?.target_tokens ?? 0,
          percent: prev?.percent ?? 0,
          files_processed: state.files_processed ?? prev?.files_processed ?? 0,
        }));
        setStatus('watching');
        openSocket(sessionId);
      } else {
        setStatus('disconnected');
      }
    } catch {
      setStatus('disconnected');
    }
  }, [sessionId, openSocket]);

  // Reattach to a live session on mount / session change.
  useEffect(() => {
    setLog([]);
    setTotals(null);
    setStatus('disconnected');
    intentRef.current.stopping = false;
    if (sessionId) {
      setStatus('connecting');
      void restore();
    }
    return () => {
      intentRef.current.stopping = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId, restore]);

  const start = useCallback(
    async (options?: WatchStartOptions) => {
      intentRef.current.stopping = false;
      setStatus('connecting');
      setLog([]);
      setTotals(null);
      try {
        await fetchJson(`/api/watch/start`, {
          method: 'POST',
          body: JSON.stringify({ session_id: sessionId, options: options ?? {} }),
        });
        setStatus('watching');
        openSocket(sessionId);
      } catch {
        setStatus('disconnected');
        throw new Error('watch start failed');
      }
    },
    [sessionId, openSocket],
  );

  const stop = useCallback(async () => {
    intentRef.current.stopping = true;
    setStatus('stopping');
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    try {
      await fetchJson(`/api/watch/stop`, {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      });
      wsRef.current?.close();
      wsRef.current = null;
      setStatus('stopped');
    } catch {
      intentRef.current.stopping = false;
      setStatus('reconnecting');
    }
  }, [sessionId]);

  const clear = useCallback(() => {
    setLog([]);
    setTotals(null);
  }, []);

  return { status, log, totals, start, stop, clear };
}