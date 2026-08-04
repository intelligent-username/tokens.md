'use client';

import { useState, type CSSProperties } from 'react';
import copy from '@/lib/copy';
import { clip } from '@/lib/api/endpoints';
import { uploadFiles } from '@/lib/api/upload';
import type { ClipResponse, UploadResponse } from '@/lib/api/types';
import { useWorkspaceState } from '@/lib/hooks/useWorkspaceState';
import { useUpload } from '@/lib/hooks/useUpload';
import { useClipboard } from '@/lib/hooks/useClipboard';
import { useTokenMeter } from '@/lib/hooks/useTokenMeter';
import { useToast } from '@/lib/hooks/useToast';
import { DropZone } from '@/components/ui/DropZone';
import { FileList } from '@/components/ui/FileList';
import { ConfigCard } from '@/components/ui/ConfigCard';
import { Toggle } from '@/components/ui/Toggle';
import { MergeButton } from '@/components/ui/MergeButton';
import { CopyButton } from '@/components/ui/CopyButton';
import { DownloadButton } from '@/components/ui/DownloadButton';
import { TokenFlowMeter } from '@/components/ui/TokenFlowMeter';
import { MarkdownPreview } from '@/components/ui/MarkdownPreview';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';

const rowStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '14px' };

const resultStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
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

const manualStyle: CSSProperties = {
  width: '100%',
  minHeight: '120px',
  padding: '10px',
  borderRadius: '12px',
  border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
  background: 'var(--color-input, rgba(255,255,255,0.05))',
  color: 'var(--color-foreground, #E9F6EE)',
  fontSize: '13px',
  fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)',
};

/**
 * Clip workspace: POST /api/clip. Combines files into Markdown and copies it
 * to the clipboard. Falls back to a manual copy surface when blocked.
 */
export function ClipWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ClipResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const [write, setWrite] = useState(false);
  const [stripHeadersFooters, setStripHeadersFooters] = useState(false);
  const [writeImages, setWriteImages] = useState(false);
  const [pages, setPages] = useState('');

  const { toast } = useToast();
  const { upload } = useUpload(files);
  const { copy } = useClipboard();
  const meter = useTokenMeter(0, result?.tokens ?? 0, { converting: running });

  const { queue, setQueue, run } = useWorkspaceState(files, {
    onRun: async () => {
      setRunning(true);
      setError(null);
      setResult(null);
      setBlocked(false);
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
        const res = await clip({
          session_id: sid,
          file_ids: up!.files.map((f) => f.file_id),
          options: {
            write,
            strip_headers_footers: stripHeadersFooters,
            write_images: writeImages,
            pages: pages || undefined,
          },
        });
        setResult(res);
        const outcome = await copy(res.text);
        setBlocked(outcome === 'blocked');
        setQueue(queue.map((item) => ({ ...item, status: 'done' as const })));
        if (outcome === 'ok') {
          toast(copy.clipConfirmation(res.tokens, res.lines), 'success');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : copy.copyIdle);
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
    setBlocked(false);
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

      <ConfigCard title="Clip options">
        <div style={rowStyle}>
          <Toggle checked={write} onChange={setWrite} label="Also save .md" />
          <Toggle
            checked={stripHeadersFooters}
            onChange={setStripHeadersFooters}
            label="Strip headers & footers"
          />
          <Toggle checked={writeImages} onChange={setWriteImages} label="Write images" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            <span style={{ opacity: 0.75, fontWeight: 600 }}>Pages</span>
            <input
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '12px',
                border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
                background: 'var(--color-input, rgba(255,255,255,0.05))',
                color: 'var(--color-foreground, #E9F6EE)',
                fontSize: '13px',
                fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)',
              }}
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
        label={copy.copyIdle}
      />

      <TokenFlowMeter
        state={meter.state}
        sourceTokens={meter.sourceTokens}
        targetTokens={meter.targetTokens}
      />

      {running ? <LoadingState label={copy.copyingBusy} /> : null}
      {error ? <ErrorState message={error} onRetry={run} /> : null}

      {result ? (
        <div style={resultStyle}>
          <div style={headerStyle}>
            <span style={{ fontWeight: 700 }}>
              {copy.clipConfirmation(result.tokens, result.lines)}
            </span>
            <div style={actionsStyle}>
              <CopyButton text={result.text} label={copy.copyMarkdown} />
              <DownloadButton filename="clip.md" content={result.text} />
            </div>
          </div>
          {blocked ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px', opacity: 0.85 }}>{copy.clipBlocked}</span>
              <textarea readOnly value={result.text} style={manualStyle} aria-label={copy.copyManually} />
            </div>
          ) : null}
          <MarkdownPreview markdown={result.text} filename="clip.md" />
        </div>
      ) : null}

      {!running && !error && !result && files.length === 0 ? (
        <EmptyState title={copy.dropFilesToConvert} />
      ) : null}
    </div>
  );
}