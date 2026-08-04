"use client";

import { ArrowsLeftRight } from "@phosphor-icons/react";

export type CommandId = "convert";

export interface CommandNavProps {
  active?: CommandId;
  onChange?: (id: CommandId) => void;
  disabled?: boolean;
}

/**
 * Streamlined single-workspace navigation bar for tokens.md.
 */
export function CommandNav({ disabled }: CommandNavProps) {
  return (
    <nav aria-label="Commands" className="flex items-center gap-1">
      <button
        type="button"
        role="tab"
        aria-selected={true}
        disabled={disabled}
        className="relative inline-flex h-9 shrink-0 items-center gap-2 rounded-control px-3.5 text-sm font-bold bg-accent text-accent-foreground shadow-glow"
      >
        <ArrowsLeftRight size={16} className="text-emerald-500" aria-hidden="true" />
        Workbench
        <span
          className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-500"
          aria-hidden="true"
        />
      </button>
    </nav>
  );
}