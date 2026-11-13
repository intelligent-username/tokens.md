"use client";

import { useState } from "react";
import { Info } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

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
  const tooltipId = `toggle-tooltip-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

  return (
    <div
      tabIndex={disabled ? -1 : 0}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={showHover && tooltip ? tooltipId : undefined}
      aria-disabled={disabled || undefined}
      onMouseEnter={() => setShowHover(true)}
      onMouseLeave={() => setShowHover(false)}
      onFocus={() => setShowHover(true)}
      onBlur={() => setShowHover(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setShowHover(false);
        } else if ((e.key === " " || e.key === "Enter") && !disabled) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      onClick={() => !disabled && onChange(!checked)}
      className="relative flex items-center justify-between gap-3 p-3 rounded-control bg-secondary/30 hover:bg-secondary/60 border border-border/40 hover:border-border/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors cursor-pointer select-none group w-full"
    >
      <div className="flex flex-col min-w-0 flex-1">
        <span className="flex items-center gap-1 text-xs font-medium text-foreground">
          <span className="truncate">{label}</span>
          {tooltip ? <Info size={16} className="text-muted-foreground transition-colors shrink-0" aria-hidden="true" /> : null}
        </span>
        {description ? <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">{description}</span> : null}
      </div>

      <div className={cn("relative flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors border", checked ? "bg-primary border-primary" : "bg-muted border-muted-foreground", disabled && "opacity-50 cursor-not-allowed")}>
        <span className={cn("h-3.5 w-3.5 rounded-full transition-transform", checked ? "translate-x-[16px] bg-primary-foreground" : "translate-x-0 bg-muted-foreground")} />
      </div>

      {showHover && tooltip ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="fixed bottom-4 left-4 right-4 z-50 rounded-control border border-border bg-card p-3 text-xs text-card-foreground shadow-md pointer-events-none sm:left-auto sm:w-72 sm:max-w-[calc(100vw-2rem)]"
        >
          <div className="font-medium text-foreground mb-1 flex items-center gap-1">
            <Info size={16} aria-hidden="true" /> {label}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{tooltip}</p>
        </div>
      ) : null}
    </div>
  );
}
