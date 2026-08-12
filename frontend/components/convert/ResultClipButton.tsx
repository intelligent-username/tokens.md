'use client';

import { Check, Copy, DownloadSimple } from '@phosphor-icons/react';
import copy from '@/lib/copy';
import { downloadUrl } from '@/lib/api/endpoints';
import type { ConvertItem } from '@/lib/api/types';
import { useToast } from '@/lib/hooks/useToast';
import { useClipboard } from '@/lib/hooks/useClipboard';
import type { PreviewableOutput } from '@/lib/hooks/useMarkdownPreview';
import { MarkdownPreviewButton } from '@/components/ui/MarkdownPreviewButton';
import { DownloadAllButton } from '@/components/ui/DownloadAllButton';
import { formatTokens } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export type ConvertItemWithSession = ConvertItem & {
  session_id?: string;
};

/** Individual Result Clip Button. */
export function ResultClipButton({
  file,
  sessionId,
}: {
  file: ConvertItemWithSession;
  sessionId: string;
}) {
  const { copy: copyText, copied } = useClipboard();
  const { toast } = useToast();

  const handleClip = async () => {
    const sid = file.session_id || sessionId;
    if (!file.output_file_id || !sid) return;
    try {
      const res = await fetch(downloadUrl(sid, file.output_file_id));
      const text = await res.text();
      await copyText(text);
      toast('Markdown copied to clipboard', 'success');
    } catch {
      toast(copy.clipBlocked, 'error');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClip}
      className={cn(
        'inline-flex items-center gap-1 rounded-chip px-2 py-1 text-xs font-semibold transition-colors',
        copied
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
          : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied' : 'Clip'}
    </button>
  );
}

/** Compact total compression summary pill displayed at top of file matrix. */
export function TotalCompressionPill({
  sourceTokens,
  targetTokens,
  percent,
  sessionId,
  isMerge,
  mergeOutputFileId,
  previewOutput,
  onCopyAll,
}: {
  sourceTokens: number;
  targetTokens: number;
  percent: number;
  sessionId: string;
  isMerge?: boolean;
  mergeOutputFileId?: string;
  previewOutput?: PreviewableOutput;
  onCopyAll: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        minHeight: '80px',
        padding: '16px 24px',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-card)',
        width: '100%',
      }}
      className="flex-wrap transition-all"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Total Compression
        </span>
        <div className="flex items-baseline gap-1.5 font-mono text-xs sm:text-sm">
          <span className="text-muted-foreground">{formatTokens(sourceTokens)}</span>
          <span className="text-muted-foreground/60">→</span>
          <span className="font-bold text-emerald-400">{formatTokens(targetTokens)}</span>
        </div>
        {isMerge ? (
          <span
            title="Merged output token count."
            className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-400 border border-emerald-500/30"
          >
            output ≈ {formatTokens(targetTokens)} tokens
          </span>
        ) : (
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-400 border border-emerald-500/30">
            −{Math.abs(percent).toFixed(1)}% saved
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isMerge ? (
          <DownloadAllButton sessionId={sessionId} />
        ) : mergeOutputFileId ? (
          <>
            {previewOutput ? <MarkdownPreviewButton output={previewOutput} /> : null}
            <a
              href={downloadUrl(sessionId, mergeOutputFileId)}
              download
              aria-label="Download merged Markdown file"
              className="inline-flex items-center gap-1.5 rounded-chip bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
            >
              <DownloadSimple size={14} /> Download
            </a>
          </>
        ) : null}
        <button
          type="button"
          onClick={onCopyAll}
          className="inline-flex items-center gap-1.5 rounded-chip bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
        >
          <Copy size={14} /> Copy All
        </button>
      </div>
    </div>
  );
}
