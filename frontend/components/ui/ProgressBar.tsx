"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

export interface ProgressBarProps {
  value?: number;
  max?: number;
  indeterminate?: boolean;
  label?: string;
}

/**
 * Thin emerald progress bar. Determinate fill when value is set,
 * a looping shimmer when indeterminate. Reduced motion freezes the shimmer.
 */
export function ProgressBar({ value = 0, max = 100, indeterminate = false, label }: ProgressBarProps) {
  const reduced = useReducedMotion();
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={indeterminate ? undefined : Math.round(value)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        {indeterminate ? (
          <motion.div
            className="h-full w-1/3 rounded-full bg-emerald-500"
            animate={reduced ? { x: 0 } : { x: ["-120%", "360%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : (
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {label ? <span className="font-mono text-xs text-muted-foreground">{label}</span> : null}
    </div>
  );
}