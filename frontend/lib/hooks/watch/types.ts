/**
 * Watcher streaming hook types.
 */

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

export interface WatchStatusResponse {
  running: boolean;
  started_at?: string;
  source?: string;
  output?: string;
  files_processed?: number;
  source_tokens?: number;
  target_tokens?: number;
}
