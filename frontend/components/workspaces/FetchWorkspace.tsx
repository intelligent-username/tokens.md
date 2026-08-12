'use client';

import { useState, type CSSProperties } from 'react';
import copy from '@/lib/copy';
import { fetchUrl } from '@/lib/api/endpoints';
import type { FetchResponse } from '@/lib/api/types';
import { useTokenMeter } from '@/lib/hooks/useTokenMeter';
import { useToast } from '@/lib/hooks/useToast';
import { ConfigCard } from '@/components/ui/ConfigCard';
import { MergeButton } from '@/components/ui/MergeButton';
import { DownloadButton } from '@/components/ui/DownloadButton';
import { CopyButton } from '@/components/ui/CopyButton';
import { MarkdownPreview } from '@/components/ui/MarkdownPreview';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
  background: 'var(--color-input, rgba(255,255,255,0.05))',
  color: 'var(--color-foreground, #E9F6EE)',
  fontSize: '14px',
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

/** Client-side http(s) URL check. Returns false for anything else. */
export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Fetch workspace: POST /api/fetch. Fetches a URL server-side and returns
 * clean Markdown with token counts.
 */
export function FetchWorkspace() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<FetchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const { toast } = useToast();
  const meter = useTokenMeter(result?.source_tokens ?? 0, result?.target_tokens ?? 0, {
    converting: running,
  });

  const run = async () => {
    if (running) return;
    const trimmed = url.trim();
    if (!isValidHttpUrl(trimmed)) {
      setError(copy.fetchInvalid);
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetchUrl({ url: trimmed });
      setResult(res);
      toast(copy.fetched(res.title ?? res.output_name), 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.fetchFailed);
    } finally {
      setRunning(false);
    }
  };

  const text = result?.text ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <ConfigCard title="Fetch a URL" description="Server fetches the page and returns Markdown">
        <input
          style={inputStyle}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run();
          }}
          placeholder={copy.fetchPlaceholder}
          disabled={running}
        />
      </ConfigCard>

      <MergeButton
        onClick={() => void run()}
        disabled={running}
        loading={running}
        label={copy.fetchIdle}
      />



      {running ? <LoadingState label={copy.fetchingBusy} /> : null}
      {error ? <ErrorState message={error} onRetry={run} /> : null}

      {result && text !== null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={headerStyle}>
            <span style={{ fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {result.title ?? result.output_name}
            </span>
            <span style={{ opacity: 0.85 }}>
              {result.source_tokens} → {result.target_tokens} tokens ·{' '}
              {result.percent >= 0 ? '−' : ''}
              {Math.abs(result.percent).toFixed(1)}%
            </span>
            <div style={actionsStyle}>
              <DownloadButton filename={result.output_name} content={text} />
              <CopyButton text={text} label={copy.copyMarkdown} />
            </div>
          </div>
          <MarkdownPreview content={text} />
        </div>
      ) : null}

      {!running && !error && !result ? <EmptyState title={copy.pasteUrlToFetch} /> : null}
    </div>
  );
}