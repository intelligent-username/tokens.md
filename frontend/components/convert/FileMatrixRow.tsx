'use client';

import { type Ref } from 'react';
import { DownloadSimple, X } from '@phosphor-icons/react';
import { downloadUrl } from '@/lib/api/endpoints';
import type { ConvertItem, FileMeta } from '@/lib/api/types';
import { ResultClipButton, type ConvertItemWithSession } from './ResultClipButton';
import { FileFlowStream } from './FileFlowStream';
import { MarkdownPreviewButton } from '@/components/ui/MarkdownPreviewButton';
import { formatBytes } from '@/components/ui/FileChip';
import { formatTokens } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

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

export function FileMatrixRow({
  file,
  fileKey,
  resultItem,
  meta,
  isConverting,
  isDone,
  mergeMode,
  sessionId,
  onRemoveFile,
  barRef,
}: FileMatrixRowProps) {
  return (
    <div
      key={fileKey}
      className={cn(
        'relative grid items-center gap-2 sm:gap-4 rounded-card bg-card/60 p-3 sm:p-4 border border-border/60 hover:border-border transition-colors',
        mergeMode ? 'grid-cols-[1fr_3fr]' : 'grid-cols-[1fr_3fr_1fr]',
      )}
    >
      {/* Left Card: Input File with clean accessible remove button */}
      <div className="flex items-center gap-2.5 min-w-0 min-h-[52px]">
        <button
          type="button"
          onClick={onRemoveFile}
          aria-label={`Remove ${file.name}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/70 hover:bg-destructive/15 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-none transition-all"
        >
          <X size={12} weight="bold" />
        </button>
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            isDone
              ? 'bg-emerald-500'
              : isConverting
                ? 'animate-pulse bg-amber-400'
                : 'bg-muted-foreground/60',
          )}
        />
        <div className="flex flex-col min-w-0">
          <span className="truncate font-mono text-xs sm:text-sm font-semibold text-foreground">
            {file.name}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatBytes(file.size)}
          </span>
          {meta?.source_tokens ? (
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatTokens(meta.source_tokens)} tokens
            </span>
          ) : null}
        </div>
      </div>

      {mergeMode ? (
        <div ref={barRef} className="h-3.5 w-full" />
      ) : (
        <FileFlowStream
          converting={isConverting}
          done={isDone}
          percent={resultItem?.percent}
          barRef={barRef}
        />
      )}

      {/* Right Card: Output Converted Result */}
      {!mergeMode ? (
        <div className="flex items-center justify-between gap-2 min-w-0 min-h-[52px]">
          {resultItem ? (
            <>
              <div className="flex flex-col min-w-0">
                <span className="truncate font-mono text-xs sm:text-sm font-semibold text-foreground">
                  {resultItem.output_name ?? resultItem.name}
                </span>
                {resultItem.output_size ? (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatBytes(resultItem.output_size)}
                  </span>
                ) : null}
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatTokens(resultItem.target_tokens)} tokens
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ResultClipButton file={resultItem} sessionId={resultItem.session_id || sessionId || ''} />
                {resultItem.output_file_id ? (
                  <>
                    <a
                      href={downloadUrl(resultItem.session_id || sessionId || '', resultItem.output_file_id)}
                      download
                      className="inline-flex items-center gap-1 rounded-chip bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
                    >
                      <DownloadSimple size={14} />
                    </a>
                    <MarkdownPreviewButton
                      output={{
                        sessionId: resultItem.session_id || sessionId || '',
                        fileId: resultItem.output_file_id,
                        name: resultItem.output_name ?? resultItem.name,
                      }}
                    />
                  </>
                ) : null}
              </div>
            </>
          ) : isConverting ? (
            <span className="font-mono text-xs text-amber-400 animate-pulse">
              Converting...
            </span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground/60 italic">
              Awaiting convert
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
