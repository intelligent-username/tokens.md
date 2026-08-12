/**
 * Document merge, token budget pruning, and delta calculation API types.
 */

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

export interface DeltaEntry {
  file: string;
  file_id?: string;
  source_tokens: number;
  target_tokens: number;
  percent: number;
  error?: string;
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

export interface DeltaRequest {
  session_id: string;
  file_ids: string[];
  encoding?: string;
}

export interface DeltaResponse {
  entries: DeltaEntry[];
  total_source_tokens: number;
  total_target_tokens: number;
  total_percent: number;
}
