'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from './apiBase';

export type HealthStatus = 'booting' | 'online' | 'degraded' | 'offline';

export const HEALTH_POLL_MS = 15_000;
/** Response time above this marks the backend degraded. */
export const HEALTH_SLOW_MS = 3_000;

// Job responses and WS reconnect loops trigger an immediate health check.
const listeners = new Set<() => void>();
const degradedListeners = new Set<() => void>();

/** Call after any job response to re-check health immediately. */
export function notifyJobResponse(): void {
  listeners.forEach((listener) => listener());
}

/** Force the degraded state (e.g. WS reconnect loop). */
export function markDegraded(): void {
  degradedListeners.forEach((listener) => listener());
}

/**
 * Backend health: polls GET /api/health every 15s, plus on job responses.
 * offline = request failed; degraded = ok but slow.
 */
export function useHealth(): { status: HealthStatus; retry: () => void } {
  const [status, setStatus] = useState<HealthStatus>('booting');

  const check = useCallback(async () => {
    const started = Date.now();
    try {
      const res = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
      const elapsed = Date.now() - started;
      setStatus(res.ok ? (elapsed > HEALTH_SLOW_MS ? 'degraded' : 'online') : 'offline');
    } catch {
      setStatus('offline');
    }
  }, []);

  const setDegraded = useCallback(() => {
    setStatus((prev) => (prev === 'online' ? 'degraded' : prev));
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(check, HEALTH_POLL_MS);
    listeners.add(check);
    degradedListeners.add(setDegraded);
    return () => {
      window.clearInterval(id);
      listeners.delete(check);
      degradedListeners.delete(setDegraded);
    };
  }, [check, setDegraded]);

  const retry = useCallback(() => {
    void check();
  }, [check]);

  return { status, retry };
}