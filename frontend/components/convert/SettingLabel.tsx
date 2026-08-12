"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Info } from "@phosphor-icons/react";

export interface SettingLabelProps {
  htmlFor: string;
  label: string;
  tooltip: string;
}

export function SettingLabel({ htmlFor, label, tooltip }: SettingLabelProps) {
  const [showHover, setShowHover] = useState(false);
  const tooltipId = `label-tooltip-${htmlFor}`;

  return (
    <div
      tabIndex={0}
      aria-describedby={showHover ? tooltipId : undefined}
      className="relative flex items-center gap-1.5 cursor-help w-fit select-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none rounded-sm px-0.5"
      onMouseEnter={() => setShowHover(true)}
      onMouseLeave={() => setShowHover(false)}
      onFocus={() => setShowHover(true)}
      onBlur={() => setShowHover(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setShowHover(false);
      }}
    >
      <label htmlFor={htmlFor} className="text-xs font-semibold text-foreground cursor-pointer">
        {label}
      </label>
      <Info size={14} className="text-muted-foreground/60 hover:text-emerald-400 transition-colors shrink-0" />

      <AnimatePresence>
        {showHover ? (
          <motion.div
            id={tooltipId}
            role="tooltip"
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 z-50 w-72 rounded-card border border-emerald-500/40 bg-zinc-950/95 p-3 text-xs text-foreground shadow-2xl backdrop-blur-md pointer-events-none"
          >
            <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
              <Info size={14} /> {label}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{tooltip}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
