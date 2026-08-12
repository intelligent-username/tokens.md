"use client";

import { Check, Copy } from "@phosphor-icons/react";
import copy from "@/lib/copy";
import { useClipboard } from "@/lib/hooks/useClipboard";
import { cn } from "@/lib/utils/cn";

export interface CopyButtonProps {
  text: string;
  label?: string;
  onCopied?: () => void;
}

/**
 * Copies text via B4's useClipboard; flips to a "Copied." check for the
 * hook's 2s window. Icon + label button with a descriptive aria-label.
 */
export function CopyButton({ text, label, onCopied }: CopyButtonProps) {
  const { copy: copyText, copied } = useClipboard();

  const handleClick = async () => {
    const result = await copyText(text);
    if (result === "ok") onCopied?.();
  };

  const visible = label ?? copy.copyMarkdown;

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      aria-label={visible}
      title={visible}
      className={cn("inline-flex h-9 items-center gap-1.5 rounded-control border border-border bg-secondary/50 px-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary", copied && "border-emerald-500/40 text-emerald-500")}
    >
      {copied ? <Check size={16} weight="regular" aria-hidden="true" /> : <Copy size={16} weight="regular" aria-hidden="true" />}
      {copied ? copy.copied : visible}
    </button>
  );
}
