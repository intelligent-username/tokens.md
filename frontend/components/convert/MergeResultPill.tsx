'use client';

import { DownloadSimple } from '@phosphor-icons/react';
import { downloadUrl } from '@/lib/api/endpoints';
import type { ConvertItem, MergeResponse } from '@/lib/api/types';
import { ResultClipButton } from './ResultClipButton';
import { MarkdownPreviewButton } from '@/components/ui/MarkdownPreviewButton';
import { formatBytes } from '@/components/ui/FileChip';
import { formatTokens } from '@/lib/utils/format';

export interface MergeResultPillProps {
  files: File[];
  mergeResult: MergeResponse;
  sessionId: string;
}

export function MergeResultPill({ files, mergeResult, sessionId }: MergeResultPillProps) {
  const mergedItem: ConvertItem = {
    file_id: mergeResult.output_file_id,
    name: mergeResult.output_name,
    source_tokens: mergeResult.source_tokens,
    target_tokens: mergeResult.target_tokens,
    percent: mergeResult.percent,
    output_file_id: mergeResult.output_file_id,
  };

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 transition-all"
      style={{
        minHeight: '80px',
        padding: '16px 24px',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-card)',
        width: '100%',
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Merge Result</span>
        <div className="flex items-baseline gap-1.5 font-mono text-xs sm:text-sm">
          <span className="text-muted-foreground">{formatBytes(files.reduce((sum, f) => sum + f.size, 0))}</span>
          <span className="text-muted-foreground/60">→</span>
          <span className="font-bold text-emerald-400">{mergeResult.output_name}</span>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-400 border border-emerald-500/30">
          output ≈ {formatTokens(mergeResult.target_tokens)} tokens
          {mergeResult.source_tokens > mergeResult.target_tokens && (
            <span className="ml-1.5 text-emerald-300/80 font-normal">
              (saved ≈ {formatTokens(mergeResult.source_tokens - mergeResult.target_tokens)} tokens)
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ResultClipButton file={mergedItem} sessionId={sessionId} />
        <MarkdownPreviewButton output={{ sessionId, fileId: mergeResult.output_file_id, name: mergeResult.output_name }} />
        <a
          href={downloadUrl(sessionId, mergeResult.output_file_id)}
          download
          aria-label="Download merged Markdown file"
          className="inline-flex items-center gap-1.5 rounded-chip bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
        >
          <DownloadSimple size={14} /> Download
        </a>
      </div>
    </div>
  );
}
