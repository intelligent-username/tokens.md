"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { downloadUrl } from "@/lib/api/endpoints";
import type { ConvertItem, MergeResponse } from "@/lib/api/types";
import { ResultClipButton } from "./ResultClipButton";
import { MarkdownPreviewButton } from "@/components/ui/MarkdownPreviewButton";
import { formatBytes } from "@/components/ui/FileChip";
import { formatTokens } from "@/lib/utils/format";

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
      className="flex min-w-0 flex-wrap items-center justify-between gap-4"
      style={{
        minHeight: "80px",
        padding: "16px 24px",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border)",
        background: "var(--color-card)",
        width: "100%",
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">Merge Result</span>
        <div className="flex min-w-0 flex-wrap items-baseline gap-2 font-mono text-xs tabular-nums sm:text-sm">
          <span className="text-muted-foreground">{formatBytes(files.reduce((sum, f) => sum + f.size, 0))}</span>
          <span className="text-muted-foreground/60">→</span>
          <span className="min-w-0 break-all font-medium text-foreground">{mergeResult.output_name}</span>
        </div>
        <span className="font-mono text-xs tabular-nums text-foreground">
          output ≈ {formatTokens(mergeResult.target_tokens)} tokens
          {mergeResult.source_tokens > mergeResult.target_tokens && <span className="ml-1.5 text-muted-foreground">(saved ≈ {formatTokens(mergeResult.source_tokens - mergeResult.target_tokens)} tokens)</span>}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ResultClipButton file={mergedItem} sessionId={sessionId} />
        <MarkdownPreviewButton output={{ sessionId, fileId: mergeResult.output_file_id, name: mergeResult.output_name }} />
        <a
          href={downloadUrl(sessionId, mergeResult.output_file_id)}
          download
          aria-label="Download merged Markdown file"
          className="inline-flex items-center gap-1 rounded-chip border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <DownloadSimple size={14} /> Download
        </a>
      </div>
    </div>
  );
}
