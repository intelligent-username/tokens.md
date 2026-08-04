'use client';

import { useState, type ChangeEvent } from 'react';
import { CloudArrowUp, Link as LinkIcon, Copy, Check, CaretDown, CaretUp, DownloadSimple } from '@phosphor-icons/react';
import copy from '@/lib/copy';
import { convert, merge, fetchUrl, downloadUrl } from '@/lib/api/endpoints';
import { uploadFiles } from '@/lib/api/upload';
import type { ConvertResponse, UploadResponse, ConvertItem, MergeResponse } from '@/lib/api/types';
import { useWorkspaceState } from '@/lib/hooks/useWorkspaceState';
import { useUpload } from '@/lib/hooks/useUpload';
import { useJob } from '@/lib/hooks/useJob';
import { useTokenMeter } from '@/lib/hooks/useTokenMeter';
import { useToast } from '@/lib/hooks/useToast';
import { useClipboard } from '@/lib/hooks/useClipboard';
import { DropZone } from '@/components/ui/DropZone';
import { FileList } from '@/components/ui/FileList';
import { Toggle } from '@/components/ui/Toggle';
import { MergeButton } from '@/components/ui/MergeButton';
import { DownloadAllButton } from '@/components/ui/DownloadAllButton';
import { TokenFlowMeter } from '@/components/ui/TokenFlowMeter';
import { TokenBadge } from '@/components/ui/TokenBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { BudgetInput, type BudgetUnit } from '@/components/ui/BudgetInput';
import { formatTokens } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/** Top segmented mode selector component (Upload vs Input). */
function ModeSelector({
  activeMode,
  onChange,
}: {
  activeMode: 'upload' | 'input';
  onChange: (mode: 'upload' | 'input') => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-card/80 p-1 border border-emerald-500/20 w-full max-w-sm mx-auto mb-4">
      <button
        type="button"
        onClick={() => onChange('upload')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 rounded-full py-1.5 px-3 text-xs font-semibold transition-all',
          activeMode === 'upload'
            ? 'bg-emerald-500 text-zinc-950 font-bold shadow-glow'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <CloudArrowUp size={16} /> Upload
      </button>
      <button
        type="button"
        onClick={() => onChange('input')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 rounded-full py-1.5 px-3 text-xs font-semibold transition-all',
          activeMode === 'input'
            ? 'bg-emerald-500 text-zinc-950 font-bold shadow-glow'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LinkIcon size={16} /> Input
      </button>
    </div>
  );
}

/** Unified link input box for Web Page URLs and Git Repository links. */
function UrlInputCard({
  value,
  onChange,
  onSelectExample,
}: {
  value: string;
  onChange: (val: string) => void;
  onSelectExample: (url: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-card/60 p-5 border border-emerald-500/20">
      <label htmlFor="url-input" className="text-xs font-semibold text-foreground">
        Web Page or Git Repository URL
      </label>
      <input
        id="url-input"
        type="url"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder="https://example.com/article or https://github.com/user/repo"
        className="w-full rounded-chip border border-border bg-input px-3.5 py-2 font-mono text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Examples:</span>
        <button
          type="button"
          onClick={() => onSelectExample('https://example.com/article')}
          className="rounded-chip bg-muted px-2 py-0.5 hover:text-emerald-400 transition-colors"
        >
          Web Page
        </button>
        <button
          type="button"
          onClick={() => onSelectExample('https://github.com/user/repo')}
          className="rounded-chip bg-muted px-2 py-0.5 hover:text-emerald-400 transition-colors"
        >
          Git Repo
        </button>
      </div>
    </div>
  );
}

/** Result item card featuring Clip button, TokenBadge, and Download link. */
function ResultItemCard({
  file,
  sessionId,
}: {
  file: ConvertItem;
  sessionId: string;
}) {
  const { copy: copyText, copied } = useClipboard();
  const { toast } = useToast();

  const handleClip = async () => {
    if (!file.output_file_id) return;
    try {
      const res = await fetch(downloadUrl(sessionId, file.output_file_id));
      const text = await res.text();
      await copyText(text);
      toast('Markdown copied to clipboard', 'success');
    } catch {
      toast(copy.clipBlocked, 'error');
    }
  };

  return (
    <div className="glass rounded-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-sm truncate text-foreground">{file.name}</span>
        <TokenBadge before={file.source_tokens} after={file.target_tokens} deltaPercent={file.percent} />
      </div>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
        <button
          type="button"
          onClick={handleClip}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-medium transition-colors',
            copied
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Clip'}
        </button>
        {file.output_file_id ? (
          <a
            href={downloadUrl(sessionId, file.output_file_id)}
            download
            className="inline-flex items-center gap-1.5 rounded-chip bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors"
          >
            <DownloadSimple size={14} /> Download
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** Single workspace wrapper: side-by-side Before/After layout and collapsible CLI settings. */
export function ConvertWorkspace() {
  const [activeMode, setActiveMode] = useState<'upload' | 'input'>('upload');
  const [inputUrl, setInputUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResponse | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [mergeEnabled, setMergeEnabled] = useState(false);
  const [includeToc, setIncludeToc] = useState(true);
  const [budgetValue, setBudgetValue] = useState(100);
  const [budgetUnit, setBudgetUnit] = useState<BudgetUnit>('KB');
  const [recursive, setRecursive] = useState(true);
  const [extensions, setExtensions] = useState('');
  const [stripHeadersFooters, setStripHeadersFooters] = useState(false);
  const [writeImages, setWriteImages] = useState(false);
  const [pages, setPages] = useState('');

  const { toast } = useToast();
  const { upload, progress } = useUpload(files);
  const { subscribe } = useJob();
  const { copy: copyText } = useClipboard();

  const sourceTokensTotal = mergeResult ? mergeResult.source_tokens : (result?.total_source_tokens ?? 0);
  const targetTokensTotal = mergeResult ? mergeResult.target_tokens : (result?.total_target_tokens ?? 0);

  const meter = useTokenMeter(sourceTokensTotal, targetTokensTotal, { converting: running });

  const { queue, setQueue, run } = useWorkspaceState(files, {
    onRun: async () => {
      setRunning(true);
      setError(null);
      setResult(null);
      setMergeResult(null);
      try {
        if (activeMode === 'input' && inputUrl.trim()) {
          const res = await fetchUrl({ url: inputUrl.trim() });
          setSessionId('fetch-session');
          setResult({
            results: [
              {
                file_id: 'fetch-1',
                name: res.output_name || 'fetched_article.md',
                source_tokens: res.source_tokens,
                target_tokens: res.target_tokens,
                percent: res.percent,
                output_file_id: res.output_file_id,
              },
            ],
            converted_count: 1,
            failed_count: 0,
            total_source_tokens: res.source_tokens,
            total_target_tokens: res.target_tokens,
            total_percent: res.percent,
          });
          toast('URL converted to Markdown', 'success');
          return;
        }

        let up: UploadResponse | null = null;
        await upload(async (report) => {
          up = await uploadFiles(
            files,
            files.map((f) => f.name),
            undefined,
            (loaded) => report.advance(0, loaded),
            report.signal,
          );
        });
        const sid = up!.session_id;
        setSessionId(sid);

        if (mergeEnabled) {
          const mres = await merge({
            session_id: sid,
            file_ids: up!.files.map((f) => f.file_id),
            options: {
              recursive,
              no_toc: !includeToc,
              budget: budgetValue > 0 ? budgetValue : undefined,
            },
          });
          setMergeResult(mres);
          toast(copy.mergedNFiles(files.length), 'success');
        } else {
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
              sourceTokens: res.results[i]?.source_tokens,
              targetTokens: res.results[i]?.target_tokens,
            })),
          );
          toast(copy.convertedNFiles(res.results.length), 'success');
        }
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
    setMergeResult(null);
    setError(null);
  };

  const handleCopyAll = async () => {
    if (!sessionId) return;
    const items = result?.results || [];
    if (items.length === 0 && !mergeResult) return;
    try {
      if (mergeResult) {
        const res = await fetch(downloadUrl(sessionId, mergeResult.output_file_id));
        const text = await res.text();
        await copyText(text);
      } else {
        const texts = await Promise.all(
          items.map(async (item) => {
            if (!item.output_file_id) return '';
            const res = await fetch(downloadUrl(sessionId, item.output_file_id));
            return res.text();
          }),
        );
        await copyText(texts.filter(Boolean).join('\n\n---\n\n'));
      }
      toast('All converted Markdown copied to clipboard', 'success');
    } catch {
      toast(copy.clipBlocked, 'error');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ModeSelector activeMode={activeMode} onChange={setActiveMode} />

      {/* 2-Column Side-by-Side Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column ("Before") */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-foreground">1. Before (Upload / Input)</span>
          </div>

          {activeMode === 'upload' ? (
            <DropZone onFiles={onFiles} multiple allowFolders disabled={running} />
          ) : (
            <UrlInputCard
              value={inputUrl}
              onChange={setInputUrl}
              onSelectExample={setInputUrl}
            />
          )}

          {activeMode === 'upload' && files.length > 0 ? (
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

          <MergeButton
            onClick={run}
            disabled={(activeMode === 'upload' && files.length === 0) || (activeMode === 'input' && !inputUrl.trim()) || running}
            loading={running}
            label={activeMode === 'input' ? 'Fetch & Convert' : copy.convertIdle}
          />
        </div>

        {/* Right Column ("After") */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-foreground">2. After (Converted Markdown)</span>
            {(result || mergeResult) && sessionId ? (
              <div className="flex items-center gap-2">
                {result ? <DownloadAllButton sessionId={sessionId} /> : null}
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="inline-flex items-center gap-1.5 rounded-chip bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                >
                  <Copy size={14} /> Copy All
                </button>
              </div>
            ) : null}
          </div>

          {running ? <LoadingState label={copy.convertingBusy} /> : null}
          {error ? <ErrorState message={error} onRetry={run} /> : null}

          {result && sessionId ? (
            <div className="flex flex-col gap-3">
              {result.results.map((file, i) => (
                <ResultItemCard key={file.file_id ?? i} file={file} sessionId={sessionId} />
              ))}
            </div>
          ) : null}

          {mergeResult && sessionId ? (
            <div className="flex flex-col gap-3">
              <ResultItemCard
                file={{
                  file_id: mergeResult.output_file_id,
                  name: mergeResult.output_name,
                  source_tokens: mergeResult.source_tokens,
                  target_tokens: mergeResult.target_tokens,
                  percent: mergeResult.percent,
                  output_file_id: mergeResult.output_file_id,
                }}
                sessionId={sessionId}
              />
            </div>
          ) : null}

          {!running && !error && !result && !mergeResult ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-card border border-dashed border-border p-8 text-center bg-card/30">
              <span className="text-sm text-muted-foreground">
                Converted Markdown output cards will appear here.
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Center Bridge Compression Visualizer */}
      <TokenFlowMeter
        state={meter.state}
        sourceTokens={meter.sourceTokens}
        targetTokens={meter.targetTokens}
        progress={progress.percent}
      />

      {/* Collapsible Advanced CLI Settings Accordion */}
      <div className="rounded-card border border-emerald-500/20 bg-card/40 p-4">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="flex w-full items-center justify-between text-sm font-bold text-foreground hover:text-emerald-400 transition-colors"
        >
          <span>Advanced CLI Settings & Budget Controls</span>
          {showSettings ? <CaretUp size={18} /> : <CaretDown size={18} />}
        </button>

        {showSettings ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/40 pt-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="extensions-input" className="text-xs font-semibold text-foreground">
                Extensions (comma-separated)
              </label>
              <input
                id="extensions-input"
                type="text"
                value={extensions}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setExtensions(e.target.value)}
                placeholder="pdf, docx, md, py"
                className="rounded-chip border border-border bg-input px-3 py-1.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="pages-input" className="text-xs font-semibold text-foreground">
                Pages Selection
              </label>
              <input
                id="pages-input"
                type="text"
                value={pages}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPages(e.target.value)}
                placeholder="0,2,4 or 1-10"
                className="rounded-chip border border-border bg-input px-3 py-1.5 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <BudgetInput
                value={budgetValue}
                unit={budgetUnit}
                onChange={(val, unit) => {
                  setBudgetValue(val);
                  setBudgetUnit(unit);
                }}
              />
            </div>

            <div className="flex flex-col gap-3">
              <Toggle checked={recursive} onChange={setRecursive} label="Recursive subfolders" />
              <Toggle checked={stripHeadersFooters} onChange={setStripHeadersFooters} label="Strip headers & footers" />
              <Toggle checked={writeImages} onChange={setWriteImages} label="Write images" />
            </div>

            <div className="flex flex-col gap-2 rounded-card bg-card/60 p-3 border border-border/40">
              <Toggle
                checked={mergeEnabled}
                onChange={setMergeEnabled}
                label="Merge all into single Markdown file"
              />
              {mergeEnabled ? (
                <div className="pl-6 pt-1">
                  <Toggle
                    checked={includeToc}
                    onChange={setIncludeToc}
                    label="Include Table of Contents"
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}