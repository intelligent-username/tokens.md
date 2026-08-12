/**
 * Number formatting helpers. Mirrors the CLI's format_tokens and delta_percent.
 */

const numberFormat = new Intl.NumberFormat("en-US");

/** Token count with thousands separators (e.g. "142,000"). */
export function formatTokens(n: number): string {
  return numberFormat.format(Math.round(n));
}

/**
 * Signed percent change for a source→target token pair, matching the CLI's
 * delta_percent: positive when tokens were saved. 0 when source is 0.
 */
export function deltaPercent(source: number, target: number): number {
  if (source === 0) return 0;
  return ((source - target) / source) * 100;
}
