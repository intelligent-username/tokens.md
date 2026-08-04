'use client';

import { useState, type CSSProperties } from 'react';
import copy from '@/lib/copy';
import { repo } from '@/lib/api/endpoints';
import { uploadFiles } from '@/lib/api/upload';
import { API_BASE } from '@/lib/hooks/apiBase';
import type { RepoResponse, UploadResponse } from '@/lib/api/types';
import { useWorkspaceState } from '@/lib/hooks/useWorkspaceState';
import { useUpload } from '@/lib/hooks/useUpload';
import { useTokenMeter } from '@/lib/hooks/useTokenMeter';
import { useToast } from '@/lib/hooks/useToast';
import { DropZone } from '@/components/ui/DropZone';
import { ConfigCard } from '@/components/ui/ConfigCard';
import { MergeButton } from '@/components/ui/MergeButton';
import { DownloadButton } from '@/components/ui/DownloadButton';
import { CopyButton } from '@/components/ui/CopyButton';
import { TokenFlowMeter } from '@/components/ui/TokenFlowMeter';
import { MarkdownPreview } from '@/components/ui/MarkdownPreview';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '12px',
  border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
  background: 'var(--color-input, rgba(255,255,255,0.05))',
  color: 'var(--color-foreground, #E9F6EE)',
  fontSize: '13px',
  fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)',
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

/** Fetch the manifest output file's text for preview / copy / download. */
async function fetchManifestText(sessionId: string, fileId: string): Promise<string> {
  const res = await fetch(
    `${API_BASE}/api/files/${encodeURIComponent(sessionId)}/${encodeURIComponent(fileId)}/download`,
  );
  if (!res.ok) throw new Error(copy.downloadFailed);
  return res.text();
}

/**
 * Repo workspace: POST /api/repo. Builds a single Markdown manifest from a
 * dropped folder, honoring exclude patterns.
 */
export function RepoWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<RepoResponse | null>(null);
  const [manifest, setManifest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [exclude, setExclude] = useState('');

  const { toast } = useToast();
  const { upload } = useUpload(files);
  const meter = useTokenMeter(result?.source_tokens ?? 0, result?.target_tokens ?? 0, {
    converting: running,
  });

  const { setQueue, run } = useWorkspaceState(files, {
    onRun: async () => {
      setRunning(true);
      setError(null);
      setResult(null);
      setManifest(null);
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
        const patterns = exclude
          .split(/[,\n]/)
          .map((p) => p.trim())
          .filter(Boolean);
        const res = await repo({
          session_id: sid,
          file_ids: up!.files.map((f) => f.file_id),
          exclude: patterns.length > 0 ? patterns : undefined,
        });
        setResult(res);
        setManifest(await fetchManifestText(sid, res.output_file_id));
        setQueue(files.map((f) => ({ id: `repo-${f.name}`, file: f, name: f.name, size: f.size, status: 'done' as const })));
        toast(copy.manifestBuilt(res.file_count), 'success');
      } catch (e) {
        setError(e instanceof Error ? e.message : copy.buildManifest);
      } finally {
        setRunning(false);
      }
    },
  });

  const onFiles = (next: File[]) => {
    setFiles(next);
    setQueue(next);
    setResult(null);
    setManifest(null);
    setError(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <DropZone
        onFiles={onFiles}
        allowFolders
        disabled={running}
        label={copy.dropFolderHere}
        hint={copy.dropRepoFolder}
      />

      <ConfigCard title="Manifest options">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
          <span style={{ opacity: 0.75, fontWeight: 600 }}>Exclude patterns</span>
          <input
            style={inputStyle}
            value={exclude}
            onChange={(e) => setExclude(e.target.value)}
            placeholder={copy.excludePlaceholder}
          />
        </div>
      </ConfigCard>

      <MergeButton
        onClick={run}
        disabled={files.length === 0 || running}
        loading={running}
        label={copy.buildManifest}
      />

      <TokenFlowMeter
        state={meter.state}
        sourceTokens={meter.sourceTokens}
        targetTokens={meter.targetTokens}
      />

      {running ? <LoadingState label={copy.scanningBusy} /> : null}
      {error ? <ErrorState message={error} onRetry={run} /> : null}

      {result && manifest !== null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={headerStyle}>
            <span style={{ fontWeight: 700 }}>
              {result.output_name} · {result.file_count} files
            </span>
            <span style={{ opacity: 0.85 }}>
              {result.source_tokens} → {result.target_tokens} tokens ·{' '}
              {result.percent >= 0 ? '−' : ''}
              {Math.abs(result.percent).toFixed(1)}%
            </span>
            <div style={actionsStyle}>
              <DownloadButton filename={result.output_name} content={manifest} />
              <CopyButton text={manifest} label={copy.copyMarkdown} />
            </div>
          </div>
          <MarkdownPreview markdown={manifest} filename={result.output_name} />
        </div>
      ) : null}

      {!running && !error && !result && files.length === 0 ? (
        <EmptyState title={copy.dropRepoFolder} />
      ) : null}
    </div>
  );
}