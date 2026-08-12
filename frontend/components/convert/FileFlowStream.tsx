"use client";

import { type Ref, type CSSProperties } from "react";
import { motion } from "motion/react";
import { Check, Sparkle, ArrowRight } from "@phosphor-icons/react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { cn } from "@/lib/utils/cn";

export interface FileFlowStreamProps {
  converting: boolean;
  done: boolean;
  percent?: number;
  merged?: boolean;
  barRef?: Ref<HTMLDivElement>;
}

/** Ultra-fancy particle beam stream connecting Before file directly to After file. */
export function FileFlowStream({ converting, done, percent, merged = false, barRef }: FileFlowStreamProps) {
  const reduced = useReducedMotion();

  return (
    <div ref={barRef} className="relative flex items-center justify-center w-full px-2 sm:px-4 select-none">
      {/* Laser connector line / progress bar */}
      <div className="relative h-3.5 w-full rounded-full bg-muted/80 overflow-hidden border border-border/60">
        <div className={cn("absolute inset-y-0 left-0 w-full rounded-full transition-all duration-500", done ? "bg-gradient-to-r from-emerald-500/40 via-emerald-400 to-emerald-500" : converting ? "bg-emerald-500/30" : "bg-muted/50")} />

        {/* Dynamic traveling particle beam FX while converting */}
        {converting && !reduced ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_12px_#16DE81]"
                initial={{ left: "0%", opacity: 0 }}
                animate={{ left: "100%", opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
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
          <span className="inline-flex items-center gap-0.5 rounded-full bg-zinc-950/90 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-400 shadow-glow backdrop-blur-md">−{Math.abs(percent).toFixed(1)}%</span>
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

export type FunnelGeom = {
  x0: number;
  x1: number;
  y0s: number[];
  midY: number;
  height: number;
};

const sigmoidEase = (t: number) => t * t * (3 - 2 * t);

export function MergeFunnel({ geom, active, reduced }: { geom: FunnelGeom; active: boolean; reduced: boolean }) {
  const W = geom.x1 - geom.x0;
  const paths = geom.y0s.map((y, i) => ({
    i,
    d: `M 0 ${y} C ${W / 2} ${y}, ${W / 2} ${geom.midY}, ${W} ${geom.midY}`,
  }));

  return (
    <div className="pointer-events-none absolute" style={{ left: geom.x0, top: 0, width: W, height: geom.height }}>
      <svg width={W} height={geom.height} className="overflow-visible">
        <defs>
          <linearGradient id="funnelGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#16DE81" />
          </linearGradient>
        </defs>

        {paths.map((p) => (
          <g key={p.i}>
            <path d={p.d} fill="none" stroke="url(#funnelGradient)" strokeWidth={5} strokeLinecap="round" opacity={0.85} />
            {active && !reduced ? (
              <>
                <motion.circle
                  r={4}
                  fill="#34d399"
                  style={
                    {
                      offsetPath: `path("${p.d}")`,
                      offsetDistance: "0%",
                    } as CSSProperties
                  }
                  animate={{ offsetDistance: ["0%", "100%"] }}
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
                      offsetDistance: "0%",
                    } as CSSProperties
                  }
                  animate={{ offsetDistance: ["0%", "100%"] }}
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

        {active && !reduced ? <motion.circle cx={W} cy={geom.midY} r={5} fill="#16DE81" animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }} /> : null}
      </svg>
    </div>
  );
}
