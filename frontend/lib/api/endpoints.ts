/**
 * Typed call functions for every canonical REST endpoint.
 * All use fetchJson / API_BASE from lib/api/client.ts.
 */

import { API_BASE, fetchJson } from "./client";
import type {
  BudgetRequest,
  BudgetResponse,
  ClipRequest,
  ClipResponse,
  ConvertRequest,
  ConvertResponse,
  DeltaRequest,
  DeltaResponse,
  FetchRequest,
  FetchResponse,
  ListFilesResponse,
  MergeRequest,
  MergeResponse,
  RepoRequest,
  RepoResponse,
  SessionCancelResponse,
  SessionCloseResponse,
  UploadResponse,
  WatchStartRequest,
  WatchStartResponse,
  WatchStatus,
  WatchStopResponse,
} from "./types";

/** Multipart upload without progress reporting. See lib/api/upload.ts for the XHR variant. */
export function uploadFiles(files: File[], paths: string[], sessionId?: string): Promise<UploadResponse> {
  const form = new FormData();
  files.forEach((file, index) => {
    form.append("files", file, paths[index] ?? file.name);
  });
  form.append("paths", JSON.stringify(paths));
  if (sessionId) form.append("session_id", sessionId);
  return fetchJson("/api/uploads", { method: "POST", body: form });
}

export function convert(req: ConvertRequest): Promise<ConvertResponse> {
  return fetchJson("/api/convert", { method: "POST", body: JSON.stringify(req) });
}

export function merge(req: MergeRequest): Promise<MergeResponse> {
  return fetchJson("/api/merge", { method: "POST", body: JSON.stringify(req) });
}

export function budget(req: BudgetRequest): Promise<BudgetResponse> {
  return fetchJson("/api/budget", { method: "POST", body: JSON.stringify(req) });
}

export function delta(req: DeltaRequest): Promise<DeltaResponse> {
  return fetchJson("/api/delta", { method: "POST", body: JSON.stringify(req) });
}

export function fetchUrl(req: FetchRequest): Promise<FetchResponse> {
  return fetchJson("/api/fetch", { method: "POST", body: JSON.stringify(req) });
}

export function repo(req: RepoRequest): Promise<RepoResponse> {
  return fetchJson("/api/repo", { method: "POST", body: JSON.stringify(req) });
}

export function clip(req: ClipRequest): Promise<ClipResponse> {
  return fetchJson("/api/clip", { method: "POST", body: JSON.stringify(req) });
}

export function listFiles(sessionId: string): Promise<ListFilesResponse> {
  return fetchJson(`/api/files/${encodeURIComponent(sessionId)}`);
}

export function downloadUrl(sessionId: string, fileId: string): string {
  return `${API_BASE}/api/files/${encodeURIComponent(sessionId)}/${encodeURIComponent(fileId)}/download`;
}

export function downloadAllUrl(sessionId: string): string {
  return `${API_BASE}/api/files/${encodeURIComponent(sessionId)}/download-all`;
}

export function watchStart(req: WatchStartRequest): Promise<WatchStartResponse> {
  return fetchJson("/api/watch/start", { method: "POST", body: JSON.stringify(req) });
}

export function watchStop(sessionId: string): Promise<WatchStopResponse> {
  return fetchJson("/api/watch/stop", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export function watchStatus(sessionId: string): Promise<WatchStatus> {
  return fetchJson(`/api/watch/${encodeURIComponent(sessionId)}`);
}

export function sessionClose(sessionId: string): Promise<SessionCloseResponse> {
  return fetchJson("/api/session/close", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export function sessionCancel(sessionId: string): Promise<SessionCancelResponse> {
  return fetchJson(`/api/session/${encodeURIComponent(sessionId)}/cancel`, {
    method: "POST",
  });
}
