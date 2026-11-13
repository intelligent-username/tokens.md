"use client";

import { type Ref } from "react";
import { Check, Spinner, ArrowRight } from "@phosphor-icons/react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { cn } from "@/lib/utils/cn";

export interface FileFlowStreamProps {
  converting: boolean;
  done: boolean;
  percent?: number;
  merged?: boolean;
  barRef?: Ref<HTMLDivElement>;
}

/** Connects the source and converted file states. */
export function FileFlowStream({ converting, done, percent, merged = false, barRef }: FileFlowStreamProps) {
  const reduced = useReducedMotion();

  return (
    <div ref={barRef} className="relative flex items-center justify-center w-full px-2 sm:px-4 select-none">
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("absolute inset-0 transition-colors duration-200", done ? "bg-primary/70" : converting ? "bg-primary/30" : "bg-border")} />
      </div>

      {/* Center Flow Badge */}
      <div className="absolute inset-auto flex items-center justify-center">
        {done && percent !== undefined && !merged ? (
          <span className="inline-flex items-center rounded-chip border border-border bg-background px-2 py-1 font-mono text-xs font-medium tabular-nums text-primary">−{Math.abs(percent).toFixed(1)}%</span>
        ) : done && merged ? (
          <span className="inline-flex items-center gap-1 rounded-chip border border-border bg-background px-2 py-1 font-mono text-xs font-medium text-primary">
            <Check size={12} /> merged
          </span>
        ) : converting ? (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-primary" aria-label="Converting">
            <Spinner size={16} className={reduced ? undefined : "animate-spin"} aria-hidden="true" />
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

export type FunnelGeom = {
  x0: number;
  x1: number;
  y0s: number[];
  midY: number;
  height: number;
};

export function MergeFunnel({ geom, active }: { geom: FunnelGeom; active: boolean; reduced: boolean }) {
  const W = geom.x1 - geom.x0;
  const paths = geom.y0s.map((y, i) => ({
    i,
    d: `M 0 ${y} C ${W / 2} ${y}, ${W / 2} ${geom.midY}, ${W} ${geom.midY}`,
  }));

  return (
    <div className="pointer-events-none absolute" style={{ left: geom.x0, top: 0, width: W, height: geom.height }}>
      <svg width={W} height={geom.height} className="overflow-visible text-primary" aria-hidden="true">
        {paths.map((p) => (
          <path key={p.i} d={p.d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" opacity={0.65} />
        ))}
        {active ? <circle cx={W} cy={geom.midY} r={4} fill="currentColor" /> : null}
      </svg>
    </div>
  );
}
