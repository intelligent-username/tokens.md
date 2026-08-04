'use client';

import { useEffect, useRef } from 'react';
import copy from '../../lib/copy';
import { formatPercent, formatTokens } from './format';
import type { WatchLogLine, WatchStatus, WatchTotals } from '../../lib/hooks/useWatchStream';

interface WatchLogProps {
  lines: WatchLogLine[];
  totals: WatchTotals | null;
  status: WatchStatus;
  /** Session summary rendered once stopped, e.g. "Watched 12m · 8 converted · 1 failed." */
  summary?: string;
  onClear: () => void;
  onProcessExisting: () => void;
  canProcessExisting: boolean;
}

const STATUS_LABEL: Record<WatchStatus, string> = {
  disconnected: copy.pickFolderToWatch,
  connecting: copy.starting,
  watching: copy.watching,
  reconnecting: copy.reconnecting,
  stopping: copy.stopping,
  stopped: copy.daemonStopped,
};

const KIND_COLOR: Record<WatchLogLine['kind'], string> = {
  started: 'var(--color-accent-foreground, #90EEC2)',
  queued: 'var(--color-muted-foreground, #AABBE4)',
  converting: 'var(--color-primary, #16DE81)',
  done: 'var(--color-emerald-300, #90EEC2)',
  skipped: 'var(--color-muted-foreground, #AABBE4)',
  error: '#FF8A8A',
  stopped: 'var(--color-muted-foreground, #AABBE4)',
};

/**
 * Live watch log (ux-flows §2.8). role="log", aria-live="polite", monospace
 * lines with per-file token counts and status colors. Auto-scroll pauses when
 * the user scrolls up and resumes when they return to the bottom.
 */
export function WatchLog({
  lines,
  totals,
  status,
  summary,
  onClear,
  onProcessExisting,
  canProcessExisting,
}: WatchLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    stickRef.current = atBottom;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        borderRadius: '20px',
        border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
        background: 'var(--color-card, rgba(255,255,255,0.06))',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.12))',
          fontSize: '13px',
        }}
      >
        <StatusDot status={status} />
        <span style={{ flex: '1 1 auto', fontWeight: 600 }}>{STATUS_LABEL[status]}</span>
        {totals && totals.files > 0 ? (
          <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>
            {totals.files} files · {formatTokens(totals.source_tokens)} →{' '}
            {formatTokens(totals.target_tokens)} tokens
            {totals.percent ? ` · ${formatPercent(totals.percent)}` : ''}
          </span>
        ) : null}
        <button type="button" onClick={onClear} disabled={lines.length === 0}>
          {copy.clearLog}
        </button>
      </div>

      <div
        ref={containerRef}
        role="log"
        aria-live="polite"
        aria-label={copy.watchLogLabel}
        onScroll={onScroll}
        style={{
          height: '280px',
          overflowY: 'auto',
          padding: '12px 16px',
          fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)',
          fontSize: '13px',
          lineHeight: '1.7',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {lines.length === 0 ? (
          <div style={{ opacity: 0.6, fontStyle: 'italic' }}>{copy.watchIdle}</div>
        ) : (
          lines.map((line) => (
            <div key={line.id} style={{ color: KIND_COLOR[line.kind], whiteSpace: 'pre-wrap' }}>
              {line.text}
            </div>
          ))
        )}
      </div>

      {status === 'stopped' && summary ? (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--color-border, rgba(255,255,255,0.12))',
            fontSize: '13px',
            opacity: 0.9,
          }}
        >
          {summary}
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '0 16px 12px',
        }}
      >
        {(status === 'disconnected' || status === 'stopped') && canProcessExisting ? (
          <button type="button" onClick={onProcessExisting}>
            {copy.processExisting}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: WatchStatus }) {
  const color =
    status === 'watching'
      ? 'var(--color-primary, #16DE81)'
      : status === 'reconnecting' || status === 'connecting'
        ? '#F2C94C'
        : 'var(--color-muted-foreground, #AABBE4)';
  return (
    <span
      aria-hidden="true"
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: color,
        boxShadow: status === 'watching' ? `0 0 8px ${color}` : 'none',
      }}
    />
  );
}