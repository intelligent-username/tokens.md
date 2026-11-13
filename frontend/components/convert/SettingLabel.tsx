"use client";

import { useState } from "react";
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
      className="relative flex items-center gap-1 cursor-help w-fit select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-sm px-0.5"
      onMouseEnter={() => setShowHover(true)}
      onMouseLeave={() => setShowHover(false)}
      onFocus={() => setShowHover(true)}
      onBlur={() => setShowHover(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setShowHover(false);
      }}
    >
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground cursor-pointer">
        {label}
      </label>
      <Info size={16} className="text-muted-foreground transition-colors shrink-0" aria-hidden="true" />

      {showHover ? (
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
