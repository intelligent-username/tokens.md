"use client";

import { type ChangeEvent } from "react";

export interface UrlInputCardProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: () => void;
}

/** Unified link input box for Web Page URLs and Git Repository links. */
export function UrlInputCard({ value, onChange, onSubmit }: UrlInputCardProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) {
          onSubmit?.();
        }
      }}
      className="flex flex-col gap-3 rounded-card bg-card/60 p-5 border border-border/60"
    >
      <label htmlFor="url-input" className="text-xs font-semibold text-foreground">
        Web Page or Git Repository URL
      </label>
      <input
        id="url-input"
        type="text"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder="https://example.com/article"
        className="w-full rounded-chip border border-border bg-input px-3 py-2 font-mono text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring transition-colors"
      />
    </form>
  );
}
