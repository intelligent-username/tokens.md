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
    <div className="flex items-center justify-between gap-4 rounded-card bg-card/60 p-4 border border-border/60">
      <div className="flex flex-col min-w-0">
        <span className="truncate font-mono text-sm font-semibold text-foreground">{(item.output_name ?? item.name) || inputUrl}</span>
        <span className="font-mono text-xs text-emerald-400 font-semibold">{formatTokens(item.target_tokens ?? 0)} tokens</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ResultClipButton file={item} sessionId={sessionId} />
        {item.output_file_id ? (
          <>
            <a href={downloadUrl(sessionId, item.output_file_id)} download className="inline-flex items-center gap-1.5 rounded-chip bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30">
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
