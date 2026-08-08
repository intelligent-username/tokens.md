'use client';

import { useState, useEffect, useLayoutEffect, useRef, type ChangeEvent, type Ref, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CloudArrowUp,
  Link as LinkIcon,
  Copy,
  Check,
  CaretDown,
  CaretUp,
  DownloadSimple,
  X,
  ArrowRight,
  Sparkle,
} from '@phosphor-icons/react';
import copy from '@/lib/copy';
import { convert, merge, fetchUrl, downloadUrl } from '@/lib/api/endpoints';
import { uploadFiles } from '@/lib/api/upload';
import type { ConvertResponse, UploadResponse, ConvertItem, MergeResponse, FileMeta } from '@/lib/api/types';
import { useWorkspaceState } from '@/lib/hooks/useWorkspaceState';
import { useUpload } from '@/lib/hooks/useUpload';
import { useJob } from '@/lib/hooks/useJob';
import { useToast } from '@/lib/hooks/useToast';
import { useClipboard } from '@/lib/hooks/useClipboard';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import type { PreviewableOutput } from '@/lib/hooks/useMarkdownPreview';
import { DropZone } from '@/components/ui/DropZone';
import { Toggle } from '@/components/ui/Toggle';
import { MergeButton } from '@/components/ui/MergeButton';
import { DownloadAllButton } from '@/components/ui/DownloadAllButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { BudgetInput, type BudgetUnit } from '@/components/ui/BudgetInput';
import { MarkdownPreviewButton } from '@/components/ui/MarkdownPreviewButton';
import { formatBytes } from '@/components/ui/FileChip';
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
    <div className="relative flex items-center gap-1 rounded-full bg-card/80 p-1 border border-border/60 w-full max-w-sm mx-auto mb-4">
      <motion.button
        type="button"
        onClick={() => onChange('upload')}
        whileTap={{ scale: 0.96 }}
        className={cn(
          'relative flex-1 flex items-center justify-center gap-2 rounded-full py-1.5 px-3 text-xs font-semibold transition-colors z-10 select-none cursor-pointer',
          activeMode === 'upload' ? 'text-zinc-950 font-bold' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {activeMode === 'upload' && (
          <motion.div
            layoutId="activeModePill"
            className="absolute inset-0 rounded-full bg-emerald-500 shadow-glow"
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          <CloudArrowUp size={16} /> Upload
        </span>
      </motion.button>
      <motion.button
        type="button"
        onClick={() => onChange('input')}
        whileTap={{ scale: 0.96 }}
        className={cn(
          'relative flex-1 flex items-center justify-center gap-2 rounded-full py-1.5 px-3 text-xs font-semibold transition-colors z-10 select-none cursor-pointer',
          activeMode === 'input' ? 'text-zinc-950 font-bold' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {activeMode === 'input' && (
          <motion.div
            layoutId="activeModePill"
            className="absolute inset-0 rounded-full bg-emerald-500 shadow-glow"
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          <LinkIcon size={16} /> Input
        </span>
      </motion.button>
    </div>
  );
}

const URL_EXAMPLES = [
  'https://example.com/article',
  'https://github.com/intelligent-username/tokens.md',
  'https://docs.python.org/3/',
];

/** Sigmoid-ish S-curve (smoothstep) for the merge-convergence animation. */
const sigmoidEase = (t: number) => t * t * (3 - 2 * t);

/** Unified link input box for Web Page URLs and Git Repository links. */
function UrlInputCard({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: () => void;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % URL_EXAMPLES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const currentExample = URL_EXAMPLES[index];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) {
          onSubmit?.();
        }
      }}
      className="flex flex-col gap-3 rounded-card bg-card/60 p-5 border border-border/60"
    >
      <label htmlFor="url-input" className="text-xs font-semibold text-foreground">
        Web Page or Git Repository URL
      </label>
      <input
        id="url-input"
        type="text"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={currentExample}
        className="w-full rounded-chip border border-border bg-input px-3.5 py-2 font-mono text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:transition-opacity placeholder:duration-500"
      />
    </form>
  );
}

/** Ultra-fancy particle beam stream connecting Before file directly to After file. */
function FileFlowStream({
  converting,
  done,
  percent,
  merged = false,
  barRef,
}: {
  converting: boolean;
  done: boolean;
  percent?: number;
  /** the single converged merged bar: shows a "merged" badge */
  merged?: boolean;
  /** ref to the bar element, used to measure convergence midpoints */
  barRef?: Ref<HTMLDivElement>;
}) {
  const reduced = useReducedMotion();

  return (
    <div ref={barRef} className="relative flex items-center justify-center w-full px-2 sm:px-4 select-none">
      {/* Laser connector line / progress bar */}
      <div className="relative h-3.5 w-full rounded-full bg-muted/80 overflow-hidden border border-border/60">
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-full rounded-full transition-all duration-500',
            done
              ? 'bg-gradient-to-r from-emerald-500/40 via-emerald-400 to-emerald-500'
              : converting
                ? 'bg-emerald-500/30'
                : 'bg-muted/50',
          )}
        />

        {/* Dynamic traveling particle beam FX while converting */}
        {converting && !reduced ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_12px_#16DE81]"
                initial={{ left: '0%', opacity: 0 }}
                animate={{ left: '100%', opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.25,
                }}
              />
            ))}
          </>
        ) : null}
      </div>

      {/* Center Flow Badge */}
      <div className="absolute inset-auto flex items-center justify-center">
        {done && percent !== undefined && !merged ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-zinc-950/90 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-400 shadow-glow backdrop-blur-md">
            −{Math.abs(percent).toFixed(1)}%
          </span>
        ) : done && merged ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950/90 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-400 shadow-glow backdrop-blur-md">
            <Check size={12} /> merged
          </span>
        ) : converting ? (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_#16DE81] border border-emerald-500/40">
            <Sparkle size={14} className="animate-spin" />
          </span>
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted/90 text-muted-foreground text-xs border border-border">
            <ArrowRight size={14} />
          </span>
        )}
      </div>
    </div>
  );
}

/** Geometry of the merge funnel: x-range of the flow column, each row's start y,
 *  the shared convergence y (midpoint), and the container height. */
type FunnelGeom = {
  x0: number;
  x1: number;
  y0s: number[];
  midY: number;
  height: number;
};

/**
 * Merge funnel: X separate flow lines start parallel on the left and curve
 * (sigmoid-shaped) toward the centre as they travel right, converging into a
 * single end point. Particles fly along each curve while `active`; once the
 * merge is done the animation stops and only the static curves remain.
 */
function MergeFunnel({
  geom,
  active,
  reduced,
}: {
  geom: FunnelGeom;
  active: boolean;
  reduced: boolean;
}) {
  const W = geom.x1 - geom.x0;
  const paths = geom.y0s.map((y, i) => ({
    i,
    d: `M 0 ${y} C ${W / 2} ${y}, ${W / 2} ${geom.midY}, ${W} ${geom.midY}`,
  }));

  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: geom.x0, top: 0, width: W, height: geom.height }}
    >
      <svg width={W} height={geom.height} className="overflow-visible">
        <defs>
          <linearGradient id="funnelGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#16DE81" />
          </linearGradient>
        </defs>

        {paths.map((p) => (
          <g key={p.i}>
            <path
              d={p.d}
              fill="none"
              stroke="url(#funnelGradient)"
              strokeWidth={5}
              strokeLinecap="round"
              opacity={0.85}
            />
            {active && !reduced ? (
              <>
                <motion.circle
                  r={4}
                  fill="#34d399"
                  style={
                    {
                      offsetPath: `path("${p.d}")`,
                      offsetDistance: '0%',
                    } as CSSProperties
                  }
                  animate={{ offsetDistance: ['0%', '100%'] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    ease: sigmoidEase,
                    delay: (p.i % 4) * 0.22,
                  }}
                />
                <motion.circle
                  r={3}
                  fill="#a7f3d0"
                  style={
                    {
                      offsetPath: `path("${p.d}")`,
                      offsetDistance: '0%',
                    } as CSSProperties
                  }
                  animate={{ offsetDistance: ['0%', '100%'] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    ease: sigmoidEase,
                    delay: (p.i % 4) * 0.22 + 0.55,
                  }}
                />
              </>
            ) : null}
          </g>
        ))}

        {/* The single end point every curve converges into */}
        {active && !reduced ? (
          <motion.circle
            cx={W}
            cy={geom.midY}
            r={5}
            fill="#16DE81"
            animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        ) : null}
      </svg>
    </div>
  );
}

/** Individual Result Clip Button. */
function ResultClipButton({
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
function TotalCompressionPill({
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
  /** output_file_id of the merged file, used for the merge Download link */
  mergeOutputFileId?: string;
  /** merged file for the eye button */
  previewOutput?: PreviewableOutput;
  onCopyAll: () => void;
}) {
  const savedTokens = Math.max(0, sourceTokens - targetTokens);

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
            title="Merged output token count. Source totals are raw file-size estimates, so a % savings figure would be misleading."
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

/** Single workspace wrapper: side-by-side Before/After matched rows and particle flow connectors. */
export function ConvertWorkspace() {
  const [activeMode, setActiveMode] = useState<'upload' | 'input'>('upload');
  const [inputUrl, setInputUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResponse | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeResponse | null>(null);
  const [uploadMeta, setUploadMeta] = useState<FileMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [funnelGeom, setFunnelGeom] = useState<FunnelGeom | null>(null);
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);
  const rowBarRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [mergeEnabled, setMergeEnabled] = useState(false);
  const [includeToc, setIncludeToc] = useState(true);
  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [budgetValue, setBudgetValue] = useState(100);
  const [budgetUnit, setBudgetUnit] = useState<BudgetUnit>('KB');
  const [recursive, setRecursive] = useState(true);
  const [extensions, setExtensions] = useState('');
  const [stripHeadersFooters, setStripHeadersFooters] = useState(false);
  const [writeImages, setWriteImages] = useState(false);
  const [pages, setPages] = useState('');

  const { toast } = useToast();
  const { upload } = useUpload(files);
  const { subscribe } = useJob();
  const { copy: copyText } = useClipboard();
  const reducedMotion = useReducedMotion();

  const sourceTokensTotal = mergeResult ? mergeResult.source_tokens : (result?.total_source_tokens ?? 0);
  const targetTokensTotal = mergeResult ? mergeResult.target_tokens : (result?.total_target_tokens ?? 0);
  const totalPercent = mergeResult ? mergeResult.percent : (result?.total_percent ?? 0);
  const mergeMode = mergeEnabled || Boolean(mergeResult);

  const mergedItem: ConvertItem | null = mergeResult
    ? {
        file_id: mergeResult.output_file_id,
        name: mergeResult.output_name,
        source_tokens: mergeResult.source_tokens,
        target_tokens: mergeResult.target_tokens,
        percent: mergeResult.percent,
        output_file_id: mergeResult.output_file_id,
      }
    : null;

  // In merge mode, measure each per-file flow bar to build the funnel geometry:
  // X origins on the left (each row's y) curving toward a shared midpoint line.
  useLayoutEffect(() => {
    if (!mergeMode || files.length === 0) return;
    const container = rowsContainerRef.current;
    if (!container) return;
    const bars = rowBarRefs.current
      .map((el) => el?.getBoundingClientRect())
      .filter((r): r is DOMRect => Boolean(r));
    if (bars.length === 0) return;
    const containerRect = container.getBoundingClientRect();
    setFunnelGeom({
      x0: bars[0].left - containerRect.left,
      x1: bars[0].right - containerRect.left,
      y0s: bars.map((r) => r.top + r.height / 2 - containerRect.top),
      midY:
        bars.reduce((a, r) => a + (r.top + r.height / 2), 0) / bars.length -
        containerRect.top,
      height: containerRect.height,
    });
  }, [mergeMode, files.length, mergeResult, running, uploadMeta]);

  const { queue, setQueue, run } = useWorkspaceState(files, {
    onRun: async () => {
      setRunning(true);
      setError(null);
      setResult(null);
      setMergeResult(null);
      setFunnelGeom(null);
      try {
        if (activeMode === 'input' && inputUrl.trim()) {
          const raw = inputUrl.trim();
          const targetUrl = (raw.startsWith('http://') || raw.startsWith('https://')) ? raw : `https://${raw}`;
          try {
            const res = await fetchUrl({
              url: targetUrl,
              user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            });
            setSessionId(res.session_id || 'fetch-session');
            setResult({
              results: [
                {
                  file_id: 'fetch-1',
                  name: res.output_name || 'fetched_article.md',
                  source_tokens: res.source_tokens ?? 0,
                  target_tokens: res.target_tokens ?? 0,
                  percent: res.percent ?? 0,
                  output_file_id: res.output_file_id,
                },
              ],
              converted_count: 1,
              failed_count: 0,
              total_source_tokens: res.source_tokens ?? 0,
              total_target_tokens: res.target_tokens ?? 0,
              total_percent: res.percent ?? 0,
            });
            toast('URL converted to Markdown', 'success');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to fetch or convert URL');
          } finally {
            setRunning(false);
          }
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
        setUploadMeta(up.files);

        if (mergeEnabled) {
          const mres = await merge({
            session_id: sid,
            file_ids: up!.files.map((f) => f.file_id),
            options: {
              recursive,
              no_toc: !includeToc,
              budget: (budgetEnabled && budgetValue > 0)
                ? (budgetUnit === 'Tokens'
                    ? budgetValue
                    : budgetUnit === 'MB'
                      ? Math.round(budgetValue * 1024 * 250)
                      : Math.round(budgetValue * 250))
                : undefined,
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

  const resetOutputs = () => {
    setUploadMeta(null);
    setResult(null);
    setMergeResult(null);
    setFunnelGeom(null);
    setError(null);
  };

  const onFiles = (next: File[]) => {
    const existing = new Set(files.map((f) => f.name));
    const appended = next.filter((f) => !existing.has(f.name));
    if (appended.length === 0) return;
    const merged = [...files, ...appended];
    setFiles(merged);
    setQueue(merged);
    resetOutputs();
  };

  const onRemoveFile = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    setQueue(next);
    resetOutputs();
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

  const handleModeChange = (mode: 'upload' | 'input') => {
    setActiveMode(mode);
    setResult(null);
    setMergeResult(null);
    setFunnelGeom(null);
    setSessionId(null);
    setUploadMeta(null);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <ModeSelector activeMode={activeMode} onChange={handleModeChange} />

      {/* Top Upload/Input Control Section */}
      <div className="flex flex-col gap-4">
        <AnimatePresence mode="wait" initial={false}>
          {activeMode === 'upload' ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <DropZone onFiles={onFiles} multiple allowFolders disabled={running} />
            </motion.div>
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <UrlInputCard
                value={inputUrl}
                onChange={setInputUrl}
                onSubmit={run}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <MergeButton
          onClick={run}
          disabled={
            (activeMode === 'upload' && files.length === 0) ||
            (activeMode === 'input' && !inputUrl.trim()) ||
            running
          }
          loading={running}
          label={activeMode === 'input' ? 'Fetch & Convert' : copy.convertIdle}
        />
      </div>

      {error ? <ErrorState message={error} onRetry={run} /> : null}

      {/* Side-by-Side Matched File Flow Rows (Y-Level Aligned) */}
      {files.length > 0 && activeMode === 'upload' ? (
        <div ref={rowsContainerRef} className="relative flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            <span>1. Input File ({files.length})</span>
            <span>2. Converted Markdown</span>
          </div>

          {files.map((file, i) => {
            const queueItem = queue[i];
            const resultItem = result?.results[i];
            const isConverting =
              running || queueItem?.status === 'converting' || queueItem?.status === 'uploading';
            const isDone = Boolean(resultItem || mergeResult);

            return (
              <div
                key={queueItem?.id ?? file.name ?? i}
                className={cn(
                  'relative grid items-center gap-2 sm:gap-4 rounded-card bg-card/60 p-3 sm:p-4 border border-border/60 hover:border-border transition-colors',
                  mergeMode ? 'grid-cols-[1fr_3fr]' : 'grid-cols-[1fr_3fr_1fr]',
                )}
              >
                <button
                  type="button"
                  onClick={() => onRemoveFile(i)}
                  disabled={running}
                  aria-label={`Remove ${file.name}`}
                  className="absolute -left-2 -top-2 z-10 rounded-full p-0.5 text-destructive hover:bg-destructive/15 hover:text-destructive transition-colors disabled:opacity-50"
                >
                  <X size={14} weight="bold" />
                </button>

                {/* Left Card: Input File */}
                <div className="flex items-center gap-2 min-w-0 min-h-[52px] pl-8">
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
                    {uploadMeta?.[i]?.source_tokens ? (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatTokens(uploadMeta[i].source_tokens)} tokens
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Center: in merge mode the converging funnel (drawn once over
                    the whole rows container) replaces the straight flow bars;
                    this spacer anchors the row's start position for measurement. */}
                {mergeMode ? (
                  <div
                    ref={(el) => {
                      rowBarRefs.current[i] = el;
                    }}
                    className="h-3.5 w-full"
                  />
                ) : (
                  <FileFlowStream
                    converting={isConverting}
                    done={isDone}
                    percent={resultItem?.percent}
                    barRef={(el) => {
                      rowBarRefs.current[i] = el;
                    }}
                  />
                )}

                {/* Right Card: Output Converted Result — hidden in merge mode (single merged file, no per-file outputs) */}
                {!mergeMode ? (
                  <div className="flex items-center justify-between gap-2 min-w-0 min-h-[52px]">
                    {resultItem ? (
                      <>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-mono text-xs sm:text-sm font-semibold text-foreground">
                            {resultItem.output_name ?? resultItem.name}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {formatTokens(resultItem.target_tokens)} tokens
                          </span>
                          {resultItem.output_size ? (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {formatBytes(resultItem.output_size)}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <ResultClipButton file={resultItem} sessionId={sessionId!} />
                          {resultItem.output_file_id ? (
                            <>
                              <a
                                href={downloadUrl(sessionId!, resultItem.output_file_id)}
                                download
                                className="inline-flex items-center gap-1 rounded-chip bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
                              >
                                <DownloadSimple size={14} />
                              </a>
                              <MarkdownPreviewButton
                                output={{
                                  sessionId: sessionId!,
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
          })}

          {/* Merge funnel + merged output overlay — both inside the positioned rows container */}
          {funnelGeom && mergeMode ? (
            <MergeFunnel
              geom={funnelGeom}
              active={running && !mergeResult}
              reduced={reducedMotion}
            />
          ) : null}


        </div>
      ) : null}

      {/* Input mode result row */}
      {activeMode === 'input' && result && sessionId ? (
        <div className="flex items-center justify-between gap-4 rounded-card bg-card/60 p-4 border border-border/60">
          <div className="flex flex-col min-w-0">
            <span className="truncate font-mono text-sm font-semibold text-foreground">
              {(result.results[0]?.output_name ?? result.results[0]?.name) || inputUrl}
            </span>
            <span className="font-mono text-xs text-emerald-400 font-semibold">
              {formatTokens(result.results[0]?.target_tokens ?? 0)} tokens
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ResultClipButton file={result.results[0]} sessionId={sessionId} />
            {result.results[0]?.output_file_id ? (
              <>
                <a
                  href={downloadUrl(sessionId, result.results[0].output_file_id)}
                  download
                  className="inline-flex items-center gap-1.5 rounded-chip bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
                >
                  <DownloadSimple size={14} /> Download
                </a>
                <MarkdownPreviewButton
                  output={{
                    sessionId,
                    fileId: result.results[0].output_file_id,
                    name: result.results[0].output_name ?? result.results[0].name,
                  }}
                />
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Polymorphic Bottom Slot: LoadingState while processing, result pill when complete (Upload mode only) */}
      {running ? (
        activeMode === 'upload' ? <LoadingState label={copy.convertingBusy} spinner={false} /> : null
      ) : activeMode === 'upload' && mergeResult && sessionId ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 transition-all"
          style={{
            minHeight: '80px',
            padding: '16px 24px',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-card)',
            width: '100%',
          }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Merge Result</span>
            <div className="flex items-baseline gap-1.5 font-mono text-xs sm:text-sm">
              <span className="text-muted-foreground">{formatBytes(files.reduce((sum, f) => sum + f.size, 0))}</span>
              <span className="text-muted-foreground/60">→</span>
              <span className="font-bold text-emerald-400">{mergeResult.output_name}</span>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-400 border border-emerald-500/30">
              output ≈ {formatTokens(mergeResult.target_tokens)} tokens
            </span>
          </div>
          <div className="flex items-center gap-2">
            {mergedItem ? <ResultClipButton file={mergedItem} sessionId={sessionId} /> : null}
            <MarkdownPreviewButton output={{ sessionId, fileId: mergeResult.output_file_id, name: mergeResult.output_name }} />
            <a
              href={downloadUrl(sessionId, mergeResult.output_file_id)}
              download
              aria-label="Download merged Markdown file"
              className="inline-flex items-center gap-1.5 rounded-chip bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
            >
              <DownloadSimple size={14} /> Download
            </a>
          </div>
        </div>
      ) : activeMode === 'upload' && result && !mergeResult && sessionId ? (
        <TotalCompressionPill
          sourceTokens={sourceTokensTotal}
          targetTokens={targetTokensTotal}
          percent={totalPercent}
          sessionId={sessionId}
          isMerge={false}
          onCopyAll={handleCopyAll}
        />
      ) : null}

      {/* Collapsible Advanced CLI Settings Accordion */}
      <div className="rounded-card border border-border/60 bg-card/40 p-4">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="flex w-full items-center justify-between text-sm font-bold text-foreground hover:text-emerald-400 transition-colors"
        >
          <span>Settings</span>
          {showSettings ? <CaretUp size={18} /> : <CaretDown size={18} />}
        </button>

        <AnimatePresence initial={false}>
          {showSettings ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex flex-col gap-4 border-t border-border/40 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      className="rounded-chip border border-border bg-input px-3 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
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
                      className="rounded-chip border border-border bg-input px-3 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {budgetEnabled ? (
                  <BudgetInput
                    value={budgetValue}
                    unit={budgetUnit}
                    onChange={(val, unit) => {
                      setBudgetValue(val);
                      setBudgetUnit(unit);
                    }}
                  />
                ) : null}
                <Toggle
                  checked={budgetEnabled}
                  onChange={setBudgetEnabled}
                  label="Token budget ceiling"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-card bg-card/60 p-4 border border-border/60">
                  <div className="flex flex-col gap-3">
                    <Toggle checked={recursive} onChange={setRecursive} label="Recursive subfolders" />
                    <Toggle checked={stripHeadersFooters} onChange={setStripHeadersFooters} label="Strip headers & footers" />
                  </div>

                  <div className="flex flex-col gap-3">
                    <Toggle checked={writeImages} onChange={setWriteImages} label="Write images" />
                    <Toggle
                      checked={mergeEnabled}
                      onChange={setMergeEnabled}
                      label="Merge all into single Markdown file"
                    />
                    {mergeEnabled ? (
                      <div className="pl-4 pt-1 border-l-2 border-emerald-500/30 ml-2">
                        <Toggle
                          checked={includeToc}
                          onChange={setIncludeToc}
                          label="Include Table of Contents"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

    </div>
  );
}