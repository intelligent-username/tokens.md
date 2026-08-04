'use client';

import { useState, type CSSProperties } from 'react';
import copy from '@/lib/copy';
import { convert, downloadUrl } from '@/lib/api/endpoints';
import { uploadFiles } from '@/lib/api/upload';
import type { ConvertResponse, UploadResponse } from '@/lib/api/types';
import { useWorkspaceState } from '@/lib/hooks/useWorkspaceState';
import { useUpload } from '@/lib/hooks/useUpload';
import { useJob } from '@/lib/hooks/useJob';
import { useTokenMeter } from '@/lib/hooks/useTokenMeter';
import { useToast } from '@/lib/hooks/useToast';
import { DropZone } from '@/components/ui/DropZone';
import { FileList } from '@/components/ui/FileList';
import { ConfigCard } from '@/components/ui/ConfigCard';
import { Toggle } from '@/components/ui/Toggle';
import { MergeButton } from '@/components/ui/MergeButton';
import { DownloadAllButton } from '@/components/ui/DownloadAllButton';
import { TokenFlowMeter } from '@/components/ui/TokenFlowMeter';
import { TokenBadge } from '@/components/ui/TokenBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatTokens } from '@/lib/utils/format';

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

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '13px',
};

const labelStyle: CSSProperties = { opacity: 0.75, fontWeight: 600 };

const rowStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '14px' };

const resultCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '14px 16px',
  borderRadius: '16px',
  border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
  background: 'var(--color-card, rgba(255,255,255,0.06))',
};

const resultHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
};

const totalRowStyle: CSSProperties = {
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

const linkStyle: CSSProperties = {
  color: 'var(--color-primary, #16DE81)',
  fontSize: '13px',
  fontWeight: 600,
  textDecoration: 'none',
};

/**
 * Convert workspace: POST /api/convert. Uploads files, converts to
 * token-efficient Markdown, and shows per-file token savings.
 */
export function ConvertWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [recursive, setRecursive] = useState(false);
  const [extensions, setExtensions] = useState('');
  const [stripHeadersFooters, setStripHeadersFooters] = useState(false);
  const [writeImages, setWriteImages] = useState(false);
  const [pages, setPages] = useState('');

  const { toast } = useToast();
  const { upload, progress } = useUpload(files);
  const { subscribe } = useJob();
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
        setSessionId(sid);
        const res = await convert({
          session_id: sid,
          file_ids: up!.files.map((f) => f.file_id),
          options: {
            recursive,
            strip_headers_footers: stripHeadersFooters,
            write_images: writeImages,
            pages: pages || undefined,
            extensions: extensions
              ? extensions.split(',').map((s) => s.trim()).filter(Boolean)
              : undefined,
          },
        });
        setResult(res);
        subscribe(`convert-${sid}`, sid);
        setQueue(
          queue.map((item, i) => ({
            ...item,
            status: 'done' as const,
            sourceTokens: res.files[i]?.source_tokens,
            targetTokens: res.files[i]?.target_tokens,
          })),
        );
        toast(copy.convertedNFiles(res.files.length), 'success');
      } catch (e) {
        setError(e instanceof Error ? e.message : copy.conversionFailed(''));
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
          files={queue.map((q) => ({
            id: q.id,
            name: q.name,
            size: q.size,
            status: q.status,
          }))}
          onRemove={(id) => {
            const idx = queue.findIndex((q) => q.id === id);
            if (idx >= 0) onFiles(files.filter((_, i) => i !== idx));
          }}
          onPreview={() => undefined}
        />
      ) : null}

      <ConfigCard title="Convert options">
        <div style={rowStyle}>
          <Toggle
            checked={recursive}
            onChange={setRecursive}
            label="Recursive"
            description="Descend into subfolders"
          />
          <div style={fieldStyle}>
            <span style={labelStyle}>Extensions</span>
            <input
              style={inputStyle}
              value={extensions}
              onChange={(e) => setExtensions(e.target.value)}
              placeholder="pdf, docx, md"
            />
          </div>
          <Toggle
            checked={stripHeadersFooters}
            onChange={setStripHeadersFooters}
            label="Strip headers & footers"
          />
          <Toggle checked={writeImages} onChange={setWriteImages} label="Write images" />
          <div style={fieldStyle}>
            <span style={labelStyle}>Pages</span>
            <input
              style={inputStyle}
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder="0,2,4"
            />
          </div>
        </div>
      </ConfigCard>

      <MergeButton
        onClick={run}
        disabled={files.length === 0 || running}
        loading={running}
        label={copy.convertIdle}
      />

      <TokenFlowMeter
        state={meter.state}
        sourceTokens={meter.sourceTokens}
        targetTokens={meter.targetTokens}
        progress={progress.percent}
      />

      {running ? <LoadingState label={copy.convertingBusy} /> : null}
      {error ? <ErrorState message={error} onRetry={run} /> : null}

      {result && sessionId ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {result.files.map((file, i) => (
            <div key={file.file_id ?? i} style={resultCardStyle}>
              <div style={resultHeaderStyle}>
                <span
                  style={{
                    fontWeight: 600,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {file.name}
                </span>
                <TokenBadge
                  before={file.source_tokens}
                  after={file.target_tokens}
                  deltaPercent={file.percent}
                />
              </div>
              {file.output_file_id ? (
                <a
                  href={downloadUrl(sessionId, file.output_file_id)}
                  download
                  style={linkStyle}
                >
                  {copy.download}
                </a>
              ) : null}
            </div>
          ))}
          <div style={totalRowStyle}>
            <span style={{ fontWeight: 700 }}>
              {copy.totalReceipt(
                formatTokens(result.total_source_tokens),
                formatTokens(result.total_target_tokens),
                result.total_percent,
              )}
            </span>
            <DownloadAllButton sessionId={sessionId} />
          </div>
        </div>
      ) : null}

      {!running && !error && !result && files.length === 0 ? (
        <EmptyState title={copy.dropFilesToConvert} />
      ) : null}
    </div>
  );
}