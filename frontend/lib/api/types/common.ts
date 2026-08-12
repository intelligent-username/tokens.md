/**
 * Common file metadata, health, session, and error API types.
 */

export interface FileMeta {
  file_id: string;
  name: string;
  size: number;
  source_tokens?: number;
  relpath?: string;
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

export interface ApiError {
  code: string;
  message: string;
  status?: number;
  details?: Record<string, unknown>;
}
