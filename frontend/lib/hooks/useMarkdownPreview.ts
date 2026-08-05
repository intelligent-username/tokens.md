'use client';

import { useCallback, useState } from 'react';
import { downloadUrl } from '@/lib/api/endpoints';
import copy from '@/lib/copy';

/** A produced Markdown output that can be fetched from the backend. */
export interface PreviewableOutput {
  sessionId: string;
  fileId: string;
  /** Optional display name; used as the modal title when present. */
  name?: string;
}

/** Fetcher contract: turns a PreviewableOutput into its Markdown text. */
export type MarkdownFetcher = (output: PreviewableOutput) => Promise<string>;

/** Default fetcher: GET the download endpoint and read the body as text. */
export const fetchMarkdownText: MarkdownFetcher = async ({ sessionId, fileId }) => {
  const res = await fetch(downloadUrl(sessionId, fileId));
  if (!res.ok) throw new Error(copy.previewFailed);
  return res.text();
};

/**
 * Loads a produced Markdown file on demand and exposes modal state.
 * Reopening reuses cached content; the fetch can be retried while open.
 */
export function useMarkdownPreview(
  output: PreviewableOutput,
  fetcher: MarkdownFetcher = fetchMarkdownText,
): {
  open: boolean;
  loading: boolean;
  error: string | null;
  content: string | null;
  openPreview: () => void;
  closePreview: () => void;
} {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);

  const openPreview = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const text = await fetcher(output);
      setContent(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.previewFailed);
    } finally {
      setLoading(false);
    }
  }, [fetcher, output]);

  const closePreview = useCallback(() => {
    setOpen(false);
  }, []);

  return { open, loading, error, content, openPreview, closePreview };
}
