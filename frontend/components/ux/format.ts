'use client';

/**
 * Local number formatting for B4's ux components.
 * Kept here (within components/ux) to avoid depending on B3's lib/utils/format.ts.
 */

const nf = new Intl.NumberFormat('en-US');

export function formatTokens(n: number): string {
  return nf.format(Math.round(n));
}

/** Signed savings percent, e.g. −91.2% (U+2212 minus, CLI parity). */
export function formatPercent(p: number): string {
  return `${p >= 0 ? '−' : ''}${Math.abs(p).toFixed(1)}%`;
}

/** Round a token count up to the next hundred (for "Raise the ceiling to N+"). */
export function nextCeiling(tokens: number): number {
  return Math.ceil((tokens + 1) / 100) * 100;
}