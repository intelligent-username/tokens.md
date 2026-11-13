"use client";

import { type Ref } from "react";
import { DownloadSimple, X } from "@phosphor-icons/react";
import { downloadUrl } from "@/lib/api/endpoints";
import type { FileMeta } from "@/lib/api/types";
import { ResultClipButton, type ConvertItemWithSession } from "./ResultClipButton";
import { FileFlowStream } from "./FileFlowStream";
import { MarkdownPreviewButton } from "@/components/ui/MarkdownPreviewButton";
import { formatBytes } from "@/components/ui/FileChip";
import { formatTokens } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface FileMatrixRowProps {
  file: File;
  fileKey: string;
  resultItem?: ConvertItemWithSession;
  meta?: FileMeta;
  isConverting: boolean;
  isDone: boolean;
  mergeMode: boolean;
  sessionId: string | null;
  onRemoveFile: () => void;
  barRef?: Ref<HTMLDivElement>;
}

export function FileMatrixRow({ file, fileKey, resultItem, meta, isConverting, isDone, mergeMode, sessionId, onRemoveFile, barRef }: FileMatrixRowProps) {
  return (
    <div key={fileKey} className={cn("relative grid min-w-0 items-center gap-4 rounded-card border border-border/60 bg-card/60 p-4", mergeMode ? "grid-cols-[minmax(0,1fr)_64px] sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]" : "grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,3fr)_minmax(0,1.4fr)]")}>
      {/* Left Card: Input File with clean accessible remove button */}
      <div className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] items-center gap-x-2 gap-y-2 self-start">
        <span title={file.name} className="col-start-2 truncate font-mono text-xs sm:text-sm font-semibold text-foreground">{file.name}</span>
        <button
          type="button"
          onClick={onRemoveFile}
          aria-label={`Remove ${file.name}`}
          className="row-start-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
        >
          <X size={12} weight="bold" />
        </button>
        <div className="col-start-2 row-start-2 flex min-w-0 items-center gap-2">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", isDone ? "bg-primary" : isConverting ? "bg-primary/60" : "bg-muted-foreground/60")} aria-hidden="true" />
          <span className="sr-only">{isDone ? "Converted" : isConverting ? "Converting" : "Awaiting convert"}</span>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[11px] tabular-nums text-muted-foreground">
            <span className="whitespace-nowrap">{formatBytes(file.size)}</span>
            {meta?.source_tokens ? <span className="whitespace-nowrap">{formatTokens(meta.source_tokens)} tokens</span> : null}
          </div>
        </div>
        {mergeMode && isConverting ? <span className="col-start-2 text-xs text-muted-foreground">Converting…</span> : null}
      </div>

      {mergeMode ? <div ref={barRef} className="h-4 w-full" /> : <FileFlowStream converting={isConverting} done={isDone} percent={resultItem?.percent} barRef={barRef} />}

      {/* Right Card: Output Converted Result */}
      {!mergeMode ? (
        <div className="flex min-h-[52px] min-w-0 flex-col items-start gap-2 self-start">
          {resultItem ? (
            <>
              <span title={resultItem.output_name ?? resultItem.name} className="w-full truncate font-mono text-xs sm:text-sm font-semibold text-foreground">{resultItem.output_name ?? resultItem.name}</span>
              <div className="flex flex-wrap items-center gap-2">
                <ResultClipButton file={resultItem} sessionId={resultItem.session_id || sessionId || ""} />
                {resultItem.output_file_id ? (
                  <>
                    <a
                      href={downloadUrl(resultItem.session_id || sessionId || "", resultItem.output_file_id)}
                      download
                      aria-label={`Download ${resultItem.output_name ?? resultItem.name}`}
                      className="inline-flex items-center rounded-chip border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      <DownloadSimple size={14} />
                    </a>
                    <MarkdownPreviewButton
                      output={{
                        sessionId: resultItem.session_id || sessionId || "",
                        fileId: resultItem.output_file_id,
                        name: resultItem.output_name ?? resultItem.name,
                      }}
                    />
                  </>
                ) : null}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                {resultItem.output_size ? <span className="whitespace-nowrap">{formatBytes(resultItem.output_size)}</span> : null}
                <span className="whitespace-nowrap">{formatTokens(resultItem.target_tokens)} tokens</span>
              </div>
            </>
          ) : isConverting ? (
            <span className="sr-only">Converting...</span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">Awaiting convert</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
