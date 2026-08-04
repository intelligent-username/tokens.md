"use client";

import { useEffect, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import copy from "@/lib/copy";
import { cn } from "@/lib/utils/cn";

export interface BudgetInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  min?: number;
  /** Soft ceiling; values above it show an amber warning. */
  ceiling?: number;
}

/**
 * Strict numeric token-budget input. Digits only (strips non-numeric on
 * paste), emits null when empty, enforces a minimum of 1, and warns in amber
 * above the soft ceiling.
 */
export function BudgetInput({ value, onChange, disabled, min = 1, ceiling }: BudgetInputProps) {
  const [text, setText] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setText(value === null ? "" : String(value));
  }, [value]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setText(digits);
    const parsed = digits.length > 0 ? Number(digits) : null;
    onChange(parsed !== null && parsed >= min ? parsed : null);
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    handleChange(e.clipboardData.getData("text"));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") e.preventDefault();
  };

  const over = ceiling !== undefined && value !== null && value > ceiling;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="budget-input" className="text-sm font-semibold text-foreground">
        {copy.budgetLabel}
      </label>
      <input
        id="budget-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={copy.budgetPlaceholder}
        className={cn(
          "h-10 rounded-control border border-border bg-card/60 px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50",
          over && "border-amber-400/60",
        )}
      />
      <p className="text-xs text-muted-foreground">{copy.budgetHint}</p>
      {over ? (
        <p className="text-xs font-medium text-amber-400">{copy.raiseCeilingTo(ceiling)}</p>
      ) : null}
    </div>
  );
}