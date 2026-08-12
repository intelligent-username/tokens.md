"use client";

import { motion } from "motion/react";
import { CloudArrowUp, Link as LinkIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

export interface ModeSelectorProps {
  activeMode: "upload" | "input";
  onChange: (mode: "upload" | "input") => void;
}

/** Top segmented mode selector component (Upload vs Input). */
export function ModeSelector({ activeMode, onChange }: ModeSelectorProps) {
  return (
    <div className="relative flex items-center gap-1 rounded-full bg-card/80 p-1 border border-border/60 w-full max-w-sm mx-auto mb-4">
      <motion.button
        type="button"
        onClick={() => onChange("upload")}
        whileTap={{ scale: 0.96 }}
        className={cn("relative flex-1 flex items-center justify-center gap-2 rounded-full py-1.5 px-3 text-xs font-semibold transition-colors z-10 select-none cursor-pointer", activeMode === "upload" ? "text-zinc-950 font-bold" : "text-muted-foreground hover:text-foreground")}
      >
        {activeMode === "upload" && <motion.div layoutId="activeModePill" className="absolute inset-0 rounded-full bg-emerald-500 shadow-glow" transition={{ type: "spring", stiffness: 450, damping: 32 }} />}
        <span className="relative z-10 flex items-center gap-2">
          <CloudArrowUp size={16} /> Upload
        </span>
      </motion.button>
      <motion.button
        type="button"
        onClick={() => onChange("input")}
        whileTap={{ scale: 0.96 }}
        className={cn("relative flex-1 flex items-center justify-center gap-2 rounded-full py-1.5 px-3 text-xs font-semibold transition-colors z-10 select-none cursor-pointer", activeMode === "input" ? "text-zinc-950 font-bold" : "text-muted-foreground hover:text-foreground")}
      >
        {activeMode === "input" && <motion.div layoutId="activeModePill" className="absolute inset-0 rounded-full bg-emerald-500 shadow-glow" transition={{ type: "spring", stiffness: 450, damping: 32 }} />}
        <span className="relative z-10 flex items-center gap-2">
          <LinkIcon size={16} /> Input
        </span>
      </motion.button>
    </div>
  );
}
