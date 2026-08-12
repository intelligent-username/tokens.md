/**
 * Watcher streaming and WebSocket event API types.
 */

export interface WatchOptions {
  poll_interval?: number;
  extensions?: string[];
  once?: boolean;
  convert_opts?: Record<string, unknown>;
}

export interface WatchStartRequest {
  session_id: string;
  options?: WatchOptions;
}

export interface WatchStartResponse {
  watch_id: string;
  source: string;
  output: string;
}

export interface WatchStopResponse {
  stopped: boolean;
}

export interface WatchStatus {
  running: boolean;
  started_at?: string;
  source?: string;
  output?: string;
  files_processed?: number;
  source_tokens?: number;
  target_tokens?: number;
  percent?: number;
}

export interface WsEnvelope<T = unknown> {
  type: string;
  session_id?: string;
  ts?: number;
  data: T;
}

export interface WatchStartedData {
  source?: string;
  output?: string;
}

export interface WatchFileData {
  file: string;
  status: "queued" | "converting" | "done" | "skipped" | "error";
  source_tokens?: number;
  target_tokens?: number;
  percent?: number;
  error?: string;
}

export interface WatchTotalData {
  files: number;
  source_tokens: number;
  target_tokens: number;
  percent: number;
}

export interface WatchStoppedData {
  reason?: string;
}

export interface ProgressData {
  job_id: string;
  operation: string;
  current: number;
  total: number;
  file?: string;
  percent?: number;
}

export interface JobDoneData {
  job_id: string;
  operation: string;
  summary: unknown;
}

export interface LogData {
  level: string;
  message: string;
}

export type WatchEvent =
  | { type: "watch.started"; data: WatchStartedData }
  | { type: "watch.file"; data: WatchFileData }
  | { type: "watch.total"; data: WatchTotalData }
  | { type: "watch.stopped"; data: WatchStoppedData }
  | { type: "progress"; data: ProgressData }
  | { type: "job.done"; data: JobDoneData }
  | { type: "log"; data: LogData };
