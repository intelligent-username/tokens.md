/**
 * Watcher streaming format and sequence utilities.
 */

import type { WatchLineKind } from './types';

export const MAX_LOG_LINES = 1000;
export const MAX_BACKOFF_MS = 30_000;

let watchSeq = 0;
export const nextLineId = (): string => `watch-${++watchSeq}`;

export const fmtTokens = (n?: number): string =>
  n === undefined ? '' : new Intl.NumberFormat('en-US').format(n);

export const fmtPercent = (p?: number): string =>
  p === undefined ? '' : `${p >= 0 ? '−' : ''}${Math.abs(p)}%`;

export function lineText(
  kind: WatchLineKind,
  data: Record<string, unknown>,
): string {
  const file = String(data.file ?? '');
  switch (kind) {
    case 'started':
      return `${String(data.source ?? '')} → ${String(data.output ?? '')}`;
    case 'queued':
      return `queued ${file}`;
    case 'converting':
      return `converting ${file}`;
    case 'done':
      return `converted ${file} → ${fmtTokens(data.source_tokens as number)} → ${fmtTokens(
        data.target_tokens as number,
      )} · ${fmtPercent(data.percent as number)}`;
    case 'skipped':
      return `skipped ${file}${data.error ? ` — ${String(data.error)}` : ''}`;
    case 'error':
      return `failed ${file}${data.error ? ` — ${String(data.error)}` : ''}`;
    case 'stopped':
      return `stopped${data.reason ? ` — ${String(data.reason)}` : ''}`;
    default:
      return file;
  }
}
