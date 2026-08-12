/**
 * Conversion, clipping, repo, and url fetch API types.
 */

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
  output_name?: string;
  output_size?: number;
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

export interface ConvertRequest {
  session_id: string;
  file_ids: string[];
  options?: ConvertOptions;
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

export interface ClipResponse {
  text: string;
  chars: number;
  lines: number;
  tokens: number;
  file_count: number;
}

export interface FetchRequest {
  url: string;
  session_id?: string;
  user_agent?: string;
}

export interface FetchResponse {
  session_id?: string;
  output_file_id: string;
  output_name: string;
  source_tokens: number;
  target_tokens: number;
  percent: number;
  url: string;
  title?: string;
  text?: string;
}

export interface RepoRequest {
  session_id: string;
  file_ids: string[];
  exclude?: string[];
}

export interface RepoResponse {
  output_file_id: string;
  output_name: string;
  source_tokens: number;
  target_tokens: number;
  percent: number;
  file_count: number;
}
