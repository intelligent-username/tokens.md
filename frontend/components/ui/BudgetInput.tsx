"use client";

import { type ChangeEvent } from "react";
import { cn } from "@/lib/utils/cn";

export type BudgetUnit = "KB" | "MB" | "Tokens";

export interface BudgetInputProps {
  value: number;
  unit: BudgetUnit;
  onChange: (value: number, unit: BudgetUnit) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Budget input component featuring dual numeric text input, unit selector,
 * and range slider for token ceiling configuration.
 */
export function BudgetInput({
  value,
  unit,
  onChange,
  disabled = false,
  className,
}: BudgetInputProps) {
  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onChange(isNaN(val) ? 0 : Math.max(0, val), unit);
  };

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onChange(val, unit);
  };

  const handleUnitChange = (newUnit: BudgetUnit) => {
    onChange(value, newUnit);
  };

  const maxSlider = unit === "MB" ? 100 : unit === "KB" ? 10000 : 500000;
  const stepSlider = unit === "MB" ? 1 : unit === "KB" ? 100 : 1000;

  return (
    <div className={cn("flex flex-col gap-2.5 rounded-card bg-card/60 p-4 border border-emerald-500/20", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="budget-number-input" className="text-xs font-semibold text-foreground">
          Target Size Budget
        </label>
        <div className="flex items-center gap-1 rounded-full bg-muted/60 p-0.5 border border-border/40">
          {(["KB", "MB", "Tokens"] as BudgetUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              disabled={disabled}
              onClick={() => handleUnitChange(u)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                unit === u
                  ? "bg-emerald-500 text-zinc-950 font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="budget-number-input"
          type="number"
          min={0}
          max={maxSlider * 5}
          value={value || ""}
          disabled={disabled}
          onChange={handleNumberChange}
          placeholder="Set ceiling (e.g. 100)"
          className="w-full rounded-chip border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
        />
      </div>

      <input
        type="range"
        min={10}
        max={maxSlider}
        step={stepSlider}
        value={value}
        disabled={disabled}
        onChange={handleSliderChange}
        className="w-full accent-emerald-500 cursor-pointer disabled:opacity-50"
      />
    </div>
  );
}