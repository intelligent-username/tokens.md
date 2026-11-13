"use client";

import { CloudArrowUp, Link as LinkIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

export interface ModeSelectorProps {
  activeMode: "upload" | "input";
  onChange: (mode: "upload" | "input") => void;
}

/** Top segmented mode selector component (Upload vs Input). */
export function ModeSelector({ activeMode, onChange }: ModeSelectorProps) {
  return (
    <div className="relative mx-auto mb-4 flex w-full max-w-sm items-center gap-1 rounded-control border border-border bg-card p-1">
      <button
        type="button"
        onClick={() => onChange("upload")}
        aria-pressed={activeMode === "upload"}
        className={cn("relative z-10 flex flex-1 cursor-pointer select-none items-center justify-center gap-2 rounded-chip px-3 py-2 text-sm font-medium transition-colors", activeMode === "upload" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
      >
        <span className="relative z-10 flex items-center gap-2">
          <CloudArrowUp size={16} className={activeMode === "upload" ? "text-primary" : undefined} /> Upload
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange("input")}
        aria-pressed={activeMode === "input"}
        className={cn("relative z-10 flex flex-1 cursor-pointer select-none items-center justify-center gap-2 rounded-chip px-3 py-2 text-sm font-medium transition-colors", activeMode === "input" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
      >
        <span className="relative z-10 flex items-center gap-2">
          <LinkIcon size={16} className={activeMode === "input" ? "text-primary" : undefined} /> Input
        </span>
      </button>
    </div>
  );
}
