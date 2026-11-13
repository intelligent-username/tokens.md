"use client";

import { Eye } from "@phosphor-icons/react";
import copy from "@/lib/copy";
import { cn } from "@/lib/utils/cn";
import { useMarkdownPreview, type MarkdownFetcher, type PreviewableOutput } from "@/lib/hooks/useMarkdownPreview";
import { Modal } from "./Modal";
import { MarkdownPreview } from "./MarkdownPreview";

interface MarkdownPreviewButtonProps {
  output: PreviewableOutput;
  fetcher?: MarkdownFetcher;
  className?: string;
}

/** Eye-icon button that opens a modal preview of a produced Markdown file. */
export function MarkdownPreviewButton({ output, fetcher, className }: MarkdownPreviewButtonProps) {
  const { open, loading, error, content, openPreview, closePreview } = useMarkdownPreview(output, fetcher);

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        aria-label={copy.preview}
        title={copy.preview}
        className={cn("inline-flex items-center gap-1 rounded-chip border border-border bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground", className)}
      >
        <Eye size={14} aria-hidden="true" />
      </button>
      <Modal open={open} onClose={closePreview} title={output.name ?? copy.preview}>
        <MarkdownPreview content={content ?? undefined} loading={loading} error={error ?? undefined} />
      </Modal>
    </>
  );
}
