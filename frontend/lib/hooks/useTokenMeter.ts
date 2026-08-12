"use client";

import { useCountUp } from "./useCountUp";

export type MeterState = "idle" | "converting" | "done" | "error";

export interface TokenMeterOptions {
  /** Signal the converting phase explicitly (default derived from counts). */
  converting?: boolean;
  /** Signal a failed run; meter shows the error state. */
  error?: boolean;
}

/**
 * Drives B3's TokenFlowMeter.
 * state is derived from the counts unless opts override it:
 * idle when nothing loaded, converting while target is unknown, done once
 * target settles. savings is null until the job settles.
 */
export function useTokenMeter(
  source: number,
  target: number,
  opts?: TokenMeterOptions
): {
  state: MeterState;
  sourceTokens: number;
  targetTokens: number;
  savings: number | null;
} {
  const sourceTokens = useCountUp(source);
  const targetTokens = useCountUp(target);

  let state: MeterState;
  if (opts?.error) state = "error";
  else if (opts?.converting) state = "converting";
  else if (source <= 0 && target <= 0) state = "idle";
  else if (target <= 0) state = "converting";
  else state = "done";

  const savings = source > 0 && target > 0 ? Math.round((1 - target / source) * 1000) / 10 : null;

  return { state, sourceTokens, targetTokens, savings };
}
