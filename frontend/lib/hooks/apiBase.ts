"use client";

/**
 * Shared API base + fetch helpers for B4 hooks.
 * Hooks are self-contained (contract §0: B4's hooks import nothing from B3),
 * so they talk to the canonical endpoints directly.
 */

const envBase = typeof globalThis !== "undefined" && (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NEXT_PUBLIC_API_BASE_URL;

const isBrowser = typeof window !== "undefined" && typeof window.location !== "undefined";
const defaultBase = isBrowser && window.location.origin && window.location.origin !== "null" ? window.location.origin : "http://127.0.0.1:8642";

export const API_BASE: string = envBase || defaultBase;

/** Derive the WebSocket URL for a session. */
export function wsUrl(sessionId: string): string {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/api/ws?session_id=${encodeURIComponent(sessionId)}`;
}

/** JSON fetch against the canonical API. Throws on non-2xx. */
export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
