'use client';

import { useState, type CSSProperties } from 'react';
import copy from '@/lib/copy';
import { delta } from '@/lib/api/endpoints';
import { uploadFiles } from '@/lib/api/upload';
import type { DeltaResponse, UploadResponse } from '@/lib/api/types';
import { useWorkspaceState } from '@/lib/hooks/useWorkspaceState';
import { useUpload } from '@/lib/hooks/useUpload';
import { useTokenMeter } from '@/lib/hooks/useTokenMeter';
import { useToast } from '@/lib/hooks/useToast';
import { DropZone } from '@/components/ui/DropZone';
import { FileList } from '@/components/ui/FileList';
import { ConfigCard } from '@/components/ui/ConfigCard';
import { Select } from '@/components/ui/Select';
import { MergeButton } from '@/components/ui/MergeButton';
import { TokenFlowMeter } from '@/components/ui/TokenFlowMeter';
import { TokenBadge } from '@/components/ui/TokenBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
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

const entryStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '14px 16px',
  borderRadius: '16px',
  border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
  background: 'var(--color-card, rgba(255,255,255,0.06))',
};

const entryHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
};

const totalStyle: CSSProperties = {
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

/**
 * Delta workspace: POST /api/delta. Measures per-file token savings
 * (source → target) with a TOTAL row. Read-only measurement.
 */
export function DeltaWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<DeltaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [encoding, setEncoding] = useState('utf-8');

  const { toast } = useToast();
  const { upload } = useUpload(files);
  const meter = useTokenMeter(
    result?.total_source_tokens ?? 0,
    result?.total_target_tokens ?? 0,
    { converting: running },
  );

  const { queue, setQueue, run } = useWorkspaceState(files, {
    onRun: async () => {
      setRunning(true);
      setError(null);
      setResult(null);
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
        const res = await delta({
          session_id: sid,
          file_ids: up!.files.map((f) => f.file_id),
          encoding,
        });
        setResult(res);
        setQueue(queue.map((item) => ({ ...item, status: 'done' as const })));
        toast(copy.analyzeIdle, 'success');
      } catch (e) {
        setError(e instanceof Error ? e.message : copy.analyzeIdle);
      } finally {
        setRunning(false);
      }
    },
  });

  const onFiles = (next: File[]) => {
    setFiles(next);
    setQueue(next);
    setResult(null);
    setError(null);
  };

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

      <ConfigCard title="Delta options">
        <div style={rowStyle}>
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
        disabled={files.length === 0 || running}
        loading={running}
        label={copy.analyzeIdle}
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
          {result.entries.map((entry, i) => (
            <div key={entry.file_id ?? i} style={entryStyle}>
              <div style={entryHeaderStyle}>
                <span
                  style={{
                    fontWeight: 600,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.file}
                </span>
                <TokenBadge
                  before={entry.source_tokens}
                  after={entry.target_tokens}
                  deltaPercent={entry.percent}
                />
              </div>
              <ProgressBar
                value={Math.max(0, entry.percent)}
                max={100}
                label={`${formatTokens(entry.source_tokens)} → ${formatTokens(entry.target_tokens)}`}
              />
            </div>
          ))}
          <div style={totalStyle}>
            <span style={{ fontWeight: 700 }}>
              {copy.totalReceipt(
                formatTokens(result.total_source_tokens),
                formatTokens(result.total_target_tokens),
                result.total_percent,
              )}
            </span>
          </div>
          <span style={{ fontSize: '12px', opacity: 0.7 }}>{copy.deltaFootnote}</span>
        </div>
      ) : null}

      {!running && !error && !result && files.length === 0 ? (
        <EmptyState title={copy.dropFilesForSavings} />
      ) : null}
    </div>
  );
}