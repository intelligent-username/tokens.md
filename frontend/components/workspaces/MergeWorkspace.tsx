'use client';

import { useState, type CSSProperties } from 'react';
import copy from '@/lib/copy';
import { merge } from '@/lib/api/endpoints';
import { uploadFiles } from '@/lib/api/upload';
import { API_BASE } from '@/lib/hooks/apiBase';
import type { MergeResponse, UploadResponse } from '@/lib/api/types';
import { useWorkspaceState } from '@/lib/hooks/useWorkspaceState';
import { useUpload } from '@/lib/hooks/useUpload';
import { useTokenMeter } from '@/lib/hooks/useTokenMeter';
import { useToast } from '@/lib/hooks/useToast';
import { DropZone } from '@/components/ui/DropZone';
import { FileList } from '@/components/ui/FileList';
import { ConfigCard } from '@/components/ui/ConfigCard';
import { BudgetInput } from '@/components/ui/BudgetInput';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { MergeButton } from '@/components/ui/MergeButton';
import { DownloadButton } from '@/components/ui/DownloadButton';
import { CopyButton } from '@/components/ui/CopyButton';
import { TokenFlowMeter } from '@/components/ui/TokenFlowMeter';
import { MarkdownPreview } from '@/components/ui/MarkdownPreview';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';

const rowStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '14px' };

const pruneStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
  background: 'var(--color-card, rgba(255,255,255,0.06))',
  fontSize: '13px',
  lineHeight: '1.6',
  fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)',
  whiteSpace: 'pre-wrap',
};

const summaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '14px 16px',
  borderRadius: '16px',
  border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
  background: 'var(--color-card, rgba(255,255,255,0.06))',
  fontVariantNumeric: 'tabular-nums',
};

const actionsStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };

const ENCODINGS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'utf-16', label: 'UTF-16' },
  { value: 'latin-1', label: 'Latin-1' },
  { value: 'ascii', label: 'ASCII' },
];

/** Fetch the merged output file's text for preview / copy / download. */
async function fetchOutputText(sessionId: string, fileId: string): Promise<string> {
  const res = await fetch(
    `${API_BASE}/api/files/${encodeURIComponent(sessionId)}/${encodeURIComponent(fileId)}/download`,
  );
  if (!res.ok) throw new Error(copy.downloadFailed);
  return res.text();
}

/**
 * Merge workspace: POST /api/merge. Combines files into a single Markdown
 * doc with optional budget pruning, dedup, TOC, and delta report.
 */
export function MergeWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<MergeResponse | null>(null);
  const [docText, setDocText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [recursive, setRecursive] = useState(false);
  const [budget, setBudget] = useState<number | null>(null);
  const [encoding, setEncoding] = useState('utf-8');
  const [noConvert, setNoConvert] = useState(false);
  const [dedup, setDedup] = useState(false);
  const [noToc, setNoToc] = useState(false);
  const [delta, setDelta] = useState(false);

  const { toast } = useToast();
  const { upload } = useUpload(files);
  const meter = useTokenMeter(
    result?.source_tokens ?? 0,
    result?.target_tokens ?? 0,
    { converting: running },
  );

  const { queue, setQueue, run } = useWorkspaceState(files, {
    onRun: async () => {
      setRunning(true);
      setError(null);
      setResult(null);
      setDocText(null);
      try {
        let up: UploadResponse | null = null;
        await upload(async (report) => {
          up = await uploadFiles(
            files,
            files.map((f) => f.name),
            undefined,
            (loaded, total) => report.advance(0, loaded),
            report.signal,
          );
        });
        const sid = up!.session_id;
        setSessionId(sid);
        const res = await merge({
          session_id: sid,
          file_ids: up!.files.map((f) => f.file_id),
          options: {
            recursive,
            budget: budget ?? undefined,
            encoding,
            no_convert: noConvert,
            dedup,
            no_toc: noToc,
            delta,
          },
        });
        setResult(res);
        const text = await fetchOutputText(sid, res.output_file_id);
        setDocText(text);
        setQueue(queue.map((item) => ({ ...item, status: 'done' as const })));
        toast(copy.mergedNFiles(files.length), 'success');
      } catch (e) {
        setError(e instanceof Error ? e.message : copy.mergedNFiles(0));
      } finally {
        setRunning(false);
      }
    },
  });

  const onFiles = (next: File[]) => {
    setFiles(next);
    setQueue(next);
    setResult(null);
    setDocText(null);
    setError(null);
  };

  const pruneLines = result?.prune
    ? [
        copy.budgetHeader(result.prune.original_tokens, result.prune.final_tokens),
        result.prune.removed_blocks > 0
          ? copy.removedLicenseDisclaimers(result.prune.removed_blocks, result.prune.removed_tokens)
          : null,
        result.prune.fits
          ? copy.finalFits(result.prune.final_tokens)
          : copy.finalOver(result.prune.final_tokens),
      ]
        .filter((line): line is string => line !== null)
        .join('\n')
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <DropZone onFiles={onFiles} multiple allowFolders disabled={running} />

      {files.length > 0 ? (
        <FileList
          files={queue.map((q) => ({ id: q.id, name: q.name, size: q.size, status: q.status }))}
          onRemove={(id) => {
            const idx = queue.findIndex((q) => q.id === id);
            if (idx >= 0) onFiles(files.filter((_, i) => i !== idx));
          }}
          onPreview={() => undefined}
        />
      ) : null}

      <ConfigCard title="Merge options">
        <div style={rowStyle}>
          <Toggle
            checked={recursive}
            onChange={setRecursive}
            label="Recursive"
            description="Descend into subfolders"
          />
          <BudgetInput value={budget} onChange={setBudget} disabled={running} />
          <Select
            value={encoding}
            onChange={setEncoding}
            options={ENCODINGS}
            label="Encoding"
            disabled={running}
          />
          <Toggle
            checked={noConvert}
            onChange={setNoConvert}
            label={copy.rawLabel}
            description="Merge raw file contents without converting"
          />
          <Toggle checked={dedup} onChange={setDedup} label={copy.dedupLabel} />
          <Toggle checked={noToc} onChange={setNoToc} label={copy.tocLabel} />
          <Toggle
            checked={delta}
            onChange={setDelta}
            label="Delta"
            description="Per-file token savings in the merged doc"
          />
        </div>
      </ConfigCard>

      <MergeButton
        onClick={run}
        disabled={files.length === 0 || running}
        loading={running}
        label={copy.mergeIdle}
      />

      <TokenFlowMeter
        state={meter.state}
        sourceTokens={meter.sourceTokens}
        targetTokens={meter.targetTokens}
      />

      {running ? <LoadingState label={copy.mergingBusy} /> : null}
      {error ? <ErrorState message={error} onRetry={run} /> : null}

      {result && docText !== null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={summaryStyle}>
            <span style={{ fontWeight: 700 }}>{result.output_name}</span>
            <span style={{ opacity: 0.85 }}>
              {result.source_tokens} → {result.target_tokens} tokens ·{' '}
              {result.percent >= 0 ? '−' : ''}
              {Math.abs(result.percent).toFixed(1)}%
            </span>
            <div style={actionsStyle}>
              <DownloadButton filename={result.output_name} content={docText} />
              <CopyButton text={docText} label={copy.copyMarkdown} />
            </div>
          </div>
          {pruneLines ? <div style={pruneStyle}>{pruneLines}</div> : null}
          <MarkdownPreview markdown={docText} filename={result.output_name} />
        </div>
      ) : null}

      {!running && !error && !result && files.length === 0 ? (
        <EmptyState title={copy.dropFilesToConvert} />
      ) : null}
    </div>
  );
}