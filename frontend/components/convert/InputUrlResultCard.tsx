"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { downloadUrl } from "@/lib/api/endpoints";
import type { ConvertResponse } from "@/lib/api/types";
import { ResultClipButton } from "./ResultClipButton";
import { MarkdownPreviewButton } from "@/components/ui/MarkdownPreviewButton";
import { formatTokens } from "@/lib/utils/format";

export interface InputUrlResultCardProps {
  inputResult: ConvertResponse;
  inputUrl: string;
  sessionId: string;
}

export function InputUrlResultCard({ inputResult, inputUrl, sessionId }: InputUrlResultCardProps) {
  const item = inputResult.results[0];
  if (!item) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-card border border-border/60 bg-card/60 p-4">
      <div className="flex min-w-0 basis-40 grow flex-col">
        <span className="truncate font-mono text-sm font-semibold text-foreground">{(item.output_name ?? item.name) || inputUrl}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatTokens(item.target_tokens ?? 0)} tokens</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ResultClipButton file={item} sessionId={sessionId} />
        {item.output_file_id ? (
          <>
            <a href={downloadUrl(sessionId, item.output_file_id)} download className="inline-flex items-center gap-1 rounded-chip border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary">
              <DownloadSimple size={14} /> Download
            </a>
            <MarkdownPreviewButton
              output={{
                sessionId,
                fileId: item.output_file_id,
                name: item.output_name ?? item.name,
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
