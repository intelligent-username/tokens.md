"use client";

import { motion } from "motion/react";
import { WarningCircle } from "@phosphor-icons/react";
import copy from "@/lib/copy";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import type { MeterState } from "@/lib/hooks/useTokenMeter";
import { formatTokens } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface TokenFlowMeterProps {
  state: MeterState;
  sourceTokens?: number;
  targetTokens?: number;
  /** 0–100 upload/run progress; when given it drives the tube fill. */
  progress?: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Signature token-flow meter: a glass panel with SRC → MD readouts, an
 * emerald flow tube (animated packets while converting), and a savings
 * badge. Reduced motion renders a static fill instead of packets.
 */
export function TokenFlowMeter({ state, sourceTokens = 0, targetTokens = 0, progress }: TokenFlowMeterProps) {
  const reduced = useReducedMotion();

  const ratio =
    sourceTokens > 0 ? clamp(targetTokens / sourceTokens, 0, 1) : 0;
  const pct = progress !== undefined ? clamp(progress, 0, 100) : ratio * 100;

  const savings =
    sourceTokens > 0 && targetTokens > 0
      ? Math.round(((sourceTokens - targetTokens) / sourceTokens) * 1000) / 10
      : null;

  const error = state === "error";
  const converting = state === "converting";
  const done = state === "done";

  return (
    <section
      aria-live="polite"
      className={cn("glass rounded-card p-5", error && "border-destructive/40")}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground">SRC</span>
          <span className="font-mono text-lg tabular-nums text-muted-foreground">
            {sourceTokens > 0 ? formatTokens(sourceTokens) : "—"}
          </span>
        </div>

        <div
          className="relative h-3.5 overflow-hidden rounded-full bg-muted border border-border/40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
              error ? "bg-destructive" : "bg-emerald-500",
            )}
            style={{ width: `${pct}%` }}
          />

          {state === "idle" && !reduced ? (
            <motion.div
              className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-emerald-500/30"
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : null}

          {converting && !reduced ? (
            <>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute top-1/2 h-2 w-2 rounded-full bg-emerald-400"
                  style={{ boxShadow: "0 0 8px var(--color-emerald-500)" }}
                  initial={{ left: "0%", y: "-50%" }}
                  animate={{ left: "100%", y: "-50%" }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
                />
              ))}
            </>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground">MD</span>
          <span className="font-mono text-lg tabular-nums text-emerald-500">
            {targetTokens > 0 ? formatTokens(targetTokens) : "—"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        {error ? (
          <span className="inline-flex items-center gap-2 font-mono text-lg font-semibold tabular-nums text-destructive">
            <WarningCircle size={18} weight="regular" aria-hidden="true" />
            —
          </span>
        ) : (
          <span
            className={cn(
              "font-mono text-2xl font-semibold tabular-nums",
              done && savings !== null && savings > 0
                ? "glyph-glow text-emerald-500"
                : done && savings !== null && savings < 0
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {savings !== null ? `${savings >= 0 ? "−" : "+"}${Math.abs(savings).toFixed(1)}%` : "0%"}
          </span>
        )}

        <span className="text-sm text-muted-foreground">
          {done && savings !== null && targetTokens > 0
            ? `saved ${formatTokens(Math.max(0, sourceTokens - targetTokens))} tokens`
            : converting
              ? copy.convertingBusy
              : null}
        </span>
      </div>
    </section>
  );
}