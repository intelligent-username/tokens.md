'use client';

import { useState } from 'react';
import { Info } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  tooltip?: string;
  disabled?: boolean;
}

/**
 * Modern toggle widget with card enclosure, hover dialogue, and precise capsule knob positioning.
 */
export function Toggle({ checked, onChange, label, description, tooltip, disabled }: ToggleProps) {
  const [showHover, setShowHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setShowHover(true)}
      onMouseLeave={() => setShowHover(false)}
      onClick={() => !disabled && onChange(!checked)}
      className="relative flex items-center justify-between gap-3 p-2.5 rounded-control bg-secondary/30 hover:bg-secondary/60 border border-border/40 hover:border-border/80 transition-all cursor-pointer select-none group w-full"
    >
      <div className="flex flex-col min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span className="truncate">{label}</span>
          {tooltip ? (
            <Info size={13} className="text-muted-foreground/60 group-hover:text-emerald-400 transition-colors shrink-0" />
          ) : null}
        </span>
        {description ? <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">{description}</span> : null}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        className={cn(
          'relative flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-all border',
          checked
            ? 'bg-emerald-500 border-emerald-400/60 shadow-[0_0_10px_rgba(22,222,129,0.35)]'
            : 'bg-muted border-border/80',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span
          className={cn(
            'h-3.5 w-3.5 rounded-full transition-transform transform shadow-sm',
            checked
              ? 'translate-x-[16px] bg-zinc-950 font-bold'
              : 'translate-x-0 bg-muted-foreground/80',
          )}
        />
      </button>

      <AnimatePresence>
        {showHover && tooltip ? (
          <motion.div
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
