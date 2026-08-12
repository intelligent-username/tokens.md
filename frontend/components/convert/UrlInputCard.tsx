'use client';

import { useState, useEffect, type ChangeEvent } from 'react';

const URL_EXAMPLES = [
  'https://example.com/article',
  'https://github.com/intelligent-username/tokens.md',
  'https://docs.python.org/3/',
];

export interface UrlInputCardProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: () => void;
}

/** Unified link input box for Web Page URLs and Git Repository links. */
export function UrlInputCard({ value, onChange, onSubmit }: UrlInputCardProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % URL_EXAMPLES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const currentExample = URL_EXAMPLES[index];

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
        placeholder={currentExample}
        className="w-full rounded-chip border border-border bg-input px-3.5 py-2 font-mono text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:transition-opacity placeholder:duration-500"
      />
    </form>
  );
}
