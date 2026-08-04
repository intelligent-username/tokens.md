/**
 * TypeScript mirrors of the backend Pydantic shapes.
 * Canonical field names come from notes/frontend/00-reconciled-contract.md §1.
 */

/** File metadata for an uploaded or produced file. */
export interface FileMeta {
  file_id: string;
  name: string;
  size: number;
  target_tokens?: number;
  created?: string;
  path?: string;
}

export interface HealthResponse {
  version: string;
  encoding: string;
  extensions: string[];
}

export interface ConfigResponse {
  extensions: string[];
  limits: Record<string, number>;
  feature_flags: Record<string, boolean>;
}

export interface UploadResponse {
  session_id: string;
  files: FileMeta[];
}

export interface ListFilesResponse {
  files: FileMeta[];
}

export interface ConvertOptions {
  recursive?: boolean;
  extensions?: string[];
  strip_headers_footers?: boolean;
  write_images?: boolean;
  pages?: string;
}

export interface ConvertItem {
  file_id: string;
  name: string;
  source_tokens: number;
  target_tokens: number;
  percent: number;
  output_file_id?: string;
  status?: 'queued' | 'converting' | 'done' | 'skipped' | 'error';
  error?: string;
}

export interface ConvertResponse {
  results: ConvertItem[];
  converted_count: number;
  failed_count: number;
  total_source_tokens: number;
  total_target_tokens: number;
  total_percent: number;
}

export interface MergeOptions {
  recursive?: boolean;
  budget?: number;
  encoding?: string;
  no_convert?: boolean;
  dedup?: boolean;
  no_toc?: boolean;
  delta?: boolean;
}

export interface PruneReport {
  fits: boolean;
  original_tokens: number;
  final_tokens: number;
  removed_tokens: number;
  removed_blocks: number;
}

export interface MergeResponse {
  output_file_id: string;
  output_name: string;
  source_tokens: number;
  target_tokens: number;
  percent: number;
  prune?: PruneReport;
  delta_entries?: DeltaEntry[];
}

export interface BudgetResponse {
  fits: boolean;
  original_tokens: number;
  final_tokens: number;
  removed_tokens: number;
  removed_blocks: number;
  text?: string;
  output_file_id?: string;
  output_name?: string;
}

export interface DeltaEntry {
  file: string;
  file_id?: string;
  source_tokens: number;
  target_tokens: number;
  percent: number;
  error?: string;
}

export interface DeltaResponse {
  entries: DeltaEntry[];
  total_source_tokens: number;
  total_target_tokens: number;
  total_percent: number;
}

export interface FetchResponse {
  output_file_id: string;
  output_name: string;
  source_tokens: number;
  target_tokens: number;
  percent: number;
  url: string;
  title?: string;
  text?: string;
}

export interface RepoResponse {
  output_file_id: string;
  output_name: string;
  source_tokens: number;
  target_tokens: number;
  percent: number;
  file_count: number;
}

export interface ClipResponse {
  text: string;
  chars: number;
  lines: number;
  tokens: number;
  file_count: number;
}

export interface WatchOptions {
  poll_interval?: number;
  extensions?: string[];
  once?: boolean;
  convert_opts?: Record<string, unknown>;
}

export interface WatchStartResponse {
  watch_id: string;
  source: string;
  output: string;
}

export interface WatchStopResponse {
  stopped: boolean;
}

/** GET /api/watch/{session_id} status shape. */
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

export interface SessionCloseResponse {
  closed: boolean;
}

export interface SessionCancelResponse {
  cancelled?: boolean;
}

export interface SampleInfo {
  name: string;
  kind: string;
}

export interface SamplesResponse {
  samples: SampleInfo[];
}

// --- Request bodies -------------------------------------------------------

export interface ConvertRequest {
  session_id: string;
  file_ids: string[];
  options?: ConvertOptions;
}

export interface MergeRequest {
  session_id: string;
  file_ids: string[];
  output_name?: string;
  options?: MergeOptions;
}

export interface BudgetRequest {
  session_id: string;
  file_id?: string;
  text?: string;
  budget: number;
  encoding?: string;
}

export interface DeltaRequest {
  session_id: string;
  file_ids: string[];
  encoding?: string;
}

export interface FetchRequest {
  url: string;
  session_id?: string;
}

export interface RepoRequest {
  session_id: string;
  file_ids: string[];
  exclude?: string[];
}

export interface ClipOptions {
  write?: boolean;
  strip_headers_footers?: boolean;
  write_images?: boolean;
  pages?: string;
}

export interface ClipRequest {
  session_id: string;
  file_ids: string[];
  options?: ClipOptions;
}

export interface WatchStartRequest {
  session_id: string;
  options?: WatchOptions;
}

// --- WebSocket events (contract §1 WS schema) ------------------------------

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
  status: 'queued' | 'converting' | 'done' | 'skipped' | 'error';
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
  | { type: 'watch.started'; data: WatchStartedData }
  | { type: 'watch.file'; data: WatchFileData }
  | { type: 'watch.total'; data: WatchTotalData }
  | { type: 'watch.stopped'; data: WatchStoppedData }
  | { type: 'progress'; data: ProgressData }
  | { type: 'job.done'; data: JobDoneData }
  | { type: 'log'; data: LogData };
