/**
 * API client: base URL, normalized fetch, and read-only endpoints.
 * Re-uses API_BASE from lib/hooks/apiBase.ts (B4) and classifies errors via
 * lib/errors.ts. Builder 4's SampleRunner imports getSamples/fetchSample here.
 */

import { API_BASE } from '@/lib/hooks/apiBase';
import { classifyError, type ErrorBody, type ErrorKind } from '@/lib/errors';
import type {
  ConfigResponse,
  HealthResponse,
  SamplesResponse,
} from './types';

export { API_BASE };

/** Normalized backend error carrying its classified kind and raw body. */
export class ApiError extends Error {
  readonly kind: ErrorKind;
  readonly status?: number;
  readonly body?: ErrorBody;

  constructor(message: string, kind: ErrorKind, status?: number, body?: ErrorBody) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.body = body;
  }
}

/** Build an ApiError from an HTTP status and raw body text. */
export function parseError(status: number, text: string): ApiError {
  let body: ErrorBody | null = null;
  try {
    body = JSON.parse(text) as ErrorBody;
  } catch {
    body = null;
  }
  const errCode = body?.code || body?.error;
  if (errCode && typeof errCode === 'string') {
    return new ApiError(
      typeof body?.message === 'string' ? body.message : `HTTP ${status}`,
      classifyError(errCode),
      status,
      body ?? undefined,
    );
  }
  return new ApiError(
    body?.message ? body.message : `HTTP ${status}`,
    'unknown',
    status,
    body ?? undefined,
  );
}

async function responseError(res: Response): Promise<ApiError> {
  const text = await res.text().catch(() => '');
  return parseError(res.status, text);
}

/** JSON fetch against the canonical API. Throws ApiError on failure. */
export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Network error', 'network');
  }
  if (!res.ok) throw await responseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function getHealth(): Promise<HealthResponse> {
  return fetchJson('/api/health');
}

export function getConfig(): Promise<ConfigResponse> {
  return fetchJson('/api/config');
}

export function getSamples(): Promise<SamplesResponse> {
  return fetchJson('/api/samples');
}

/** GET /api/samples/{name} → file bytes. */
export async function fetchSample(name: string): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/samples/${encodeURIComponent(name)}`);
  } catch {
    throw new ApiError('Network error', 'network');
  }
  if (!res.ok) throw await responseError(res);
  return res.blob();
}
