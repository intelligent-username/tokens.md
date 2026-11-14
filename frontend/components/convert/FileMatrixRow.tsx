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

function FileName({ name, className }: { name: string; className?: string }) {
  const dot = name.lastIndexOf(".");
  const hasExtension = dot > 0 && dot < name.length - 1;

  return (
    <span title={name} className={cn("flex min-w-0 items-baseline font-mono text-xs font-semibold text-foreground sm:text-sm", className)}>
      <span className="sr-only">{name}</span>
      <span aria-hidden="true" className="truncate">{hasExtension ? name.slice(0, dot) : name}</span>
      {hasExtension ? <span aria-hidden="true" className="shrink-0">{name.slice(dot)}</span> : null}
    </span>
  );
}

export function FileMatrixRow({ file, fileKey, resultItem, meta, isConverting, isDone, mergeMode, sessionId, onRemoveFile, barRef }: FileMatrixRowProps) {
  return (
    <div key={fileKey} className={cn("relative grid min-w-0 items-center gap-4 rounded-card border border-border/60 bg-card/60 p-4", mergeMode ? "grid-cols-[minmax(0,1fr)_64px] sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]" : "grid-cols-1 md:grid-cols-3")}>
      {/* Left Card: Input File with clean accessible remove button */}
      <div className={cn("grid min-w-0 grid-cols-[24px_minmax(0,1fr)] grid-rows-[20px_28px_16px] items-center gap-x-2 gap-y-2 self-start", !mergeMode && "md:col-start-1 md:row-start-1")}>
        <FileName name={file.name} className="col-start-2 row-start-1" />
        <button
          type="button"
          onClick={onRemoveFile}
          aria-label={`Remove ${file.name}`}
          className="row-start-2 -ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
        >
          <X size={12} weight="bold" />
        </button>
        <div className="col-start-2 row-start-2 flex min-w-0 items-center gap-2">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", isDone ? "bg-primary" : isConverting ? "bg-primary/60" : "bg-muted-foreground/60")} aria-hidden="true" />
          <span className="sr-only">{isDone ? "Converted" : isConverting ? "Converting" : "Awaiting convert"}</span>
          {mergeMode && isConverting ? <span className="text-xs text-muted-foreground">Converting…</span> : null}
        </div>
        <div className="col-start-2 row-start-3 flex items-baseline gap-2 whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
          <span>{formatBytes(file.size)}</span>
          {meta?.source_tokens ? <span>{formatTokens(meta.source_tokens)} tokens</span> : null}
        </div>
      </div>

      {mergeMode ? <div ref={barRef} className="h-4 w-full" /> : (
        <div className="flex h-7 items-center md:col-span-3 md:col-start-1 md:row-start-1 md:ml-12 md:mr-30">
          <FileFlowStream converting={isConverting} done={isDone} percent={resultItem?.percent} barRef={barRef} />
        </div>
      )}

      {/* Right Card: Output Converted Result */}
      {!mergeMode ? (
        <div className="grid min-w-0 grid-rows-[20px_28px_16px] items-center gap-y-2 self-start md:col-start-3 md:row-start-1">
          {resultItem ? (
            <>
              <FileName name={resultItem.output_name ?? resultItem.name} className="row-start-1 w-full justify-end" />
              <div className="row-start-2 flex w-full items-center justify-end gap-2">
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
              <div className="row-start-3 flex items-baseline justify-end gap-2 whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
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
