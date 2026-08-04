'use client';

import { useState, type CSSProperties } from 'react';
import copy from '@/lib/copy';
import { budget } from '@/lib/api/endpoints';
import { uploadFiles } from '@/lib/api/upload';
import { API_BASE } from '@/lib/hooks/apiBase';
import type { BudgetResponse, UploadResponse } from '@/lib/api/types';
import { useWorkspaceState } from '@/lib/hooks/useWorkspaceState';
import { useUpload } from '@/lib/hooks/useUpload';
import { useTokenMeter } from '@/lib/hooks/useTokenMeter';
import { useToast } from '@/lib/hooks/useToast';
import { DropZone } from '@/components/ui/DropZone';
import { FileList } from '@/components/ui/FileList';
import { ConfigCard } from '@/components/ui/ConfigCard';
import { BudgetInput } from '@/components/ui/BudgetInput';
import { Select } from '@/components/ui/Select';
import { MergeButton } from '@/components/ui/MergeButton';
import { DownloadButton } from '@/components/ui/DownloadButton';
import { CopyButton } from '@/components/ui/CopyButton';
import { TokenFlowMeter } from '@/components/ui/TokenFlowMeter';
import { MarkdownPreview } from '@/components/ui/MarkdownPreview';
import { BudgetGauge } from '@/components/ux/BudgetGauge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatTokens } from '@/lib/utils/format';

const ENCODINGS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'utf-16', label: 'UTF-16' },
  { value: 'latin-1', label: 'Latin-1' },
  { value: 'ascii', label: 'ASCII' },
];

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

const headerStyle: CSSProperties = {
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

/** Fetch the pruned output file's text when the response omits it. */
async function fetchBudgetText(sessionId: string, fileId: string): Promise<string> {
  const res = await fetch(
    `${API_BASE}/api/files/${encodeURIComponent(sessionId)}/${encodeURIComponent(fileId)}/download`,
  );
  if (!res.ok) throw new Error(copy.downloadFailed);
  return res.text();
}

/**
 * Budget workspace: POST /api/budget. Prunes a file to fit a token ceiling
 * and shows the CLI-verbatim prune report plus the pruned preview.
 */
export function BudgetWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<BudgetResponse | null>(null);
  const [docText, setDocText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [budgetValue, setBudgetValue] = useState<number | null>(null);
  const [encoding, setEncoding] = useState('utf-8');

  const { toast } = useToast();
  const { upload } = useUpload(files);
  const meter = useTokenMeter(result?.original_tokens ?? 0, result?.final_tokens ?? 0, {
    converting: running,
  });

  const { queue, setQueue, run } = useWorkspaceState(files, {
    onRun: async () => {
      if (!budgetValue || budgetValue < 1) {
        setError(copy.ceilingMin);
        return;
      }
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
        const first = up!.files[0];
        if (!first) throw new Error(copy.noFilesInFolder);
        const res = await budget({
          session_id: sid,
          file_id: first.file_id,
          budget: budgetValue,
          encoding,
        });
        setResult(res);
        if (res.text !== undefined) {
          setDocText(res.text);
        } else if (res.output_file_id) {
          setDocText(await fetchBudgetText(sid, res.output_file_id));
        }
        setQueue(queue.map((item) => ({ ...item, status: 'done' as const })));
        toast(copy.fitsBudget, 'success');
      } catch (e) {
        setError(e instanceof Error ? e.message : copy.fitToBudget);
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

  const pruneLines = result
    ? [
        copy.budgetHeader(result.original_tokens, result.final_tokens),
        result.removed_blocks > 0
          ? `removed ${result.removed_blocks} blocks (−${result.removed_tokens} tokens)`
          : copy.budgetNoPrune,
        result.fits ? copy.finalFits(result.final_tokens) : copy.finalOver(result.final_tokens),
      ].join('\n')
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <DropZone onFiles={onFiles} multiple disabled={running} />

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

      <ConfigCard title="Budget options">
        <div style={rowStyle}>
          <BudgetInput value={budgetValue} onChange={setBudgetValue} disabled={running} />
          <Select
            value={encoding}
            onChange={setEncoding}
            options={ENCODINGS}
            label="Encoding"
            disabled={running}
          />
        </div>
      </ConfigCard>

      <MergeButton
        onClick={run}
        disabled={files.length === 0 || running || budgetValue === null}
        loading={running}
        label={copy.fitToBudget}
      />

      <TokenFlowMeter
        state={meter.state}
        sourceTokens={meter.sourceTokens}
        targetTokens={meter.targetTokens}
      />

      {running ? <LoadingState label={copy.analyzingBusy} /> : null}
      {error ? <ErrorState message={error} onRetry={run} /> : null}

      {result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <BudgetGauge
            sourceTokens={result.original_tokens}
            ceiling={budgetValue ?? result.final_tokens}
            fits={result.fits}
            finalTokens={result.final_tokens}
            onSuggestCeiling={setBudgetValue}
          />
          {pruneLines ? <div style={pruneStyle}>{pruneLines}</div> : null}
          {docText !== null ? (
            <>
              <div style={headerStyle}>
                <span style={{ fontWeight: 700 }}>
                  {formatTokens(result.final_tokens)} tokens
                </span>
                <div style={actionsStyle}>
                  <DownloadButton filename="budget.md" content={docText} />
                  <CopyButton text={docText} label={copy.copyMarkdown} />
                </div>
              </div>
              <MarkdownPreview markdown={docText} filename="budget.md" />
            </>
          ) : null}
        </div>
      ) : null}

      {!running && !error && !result && files.length === 0 ? (
        <EmptyState title={copy.setCeilingDropFiles} />
      ) : null}
    </div>
  );
}