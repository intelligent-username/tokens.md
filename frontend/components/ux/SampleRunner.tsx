'use client';

import { useState } from 'react';
import copy from '../../lib/copy';
import { fetchSample, getSamples } from '@/lib/api/client';
import { useToast } from '../../lib/hooks/useToast';

interface SampleRunnerProps {
  /** Runs the sample File[] through the current workspace's primary flow. */
  onSample: (files: File[]) => void;
  label?: string;
}

/**
 * "Try a sample" (ux-flows §8). Fetches the sample list from
 * GET /api/samples, prefers a PDF sample, and hands a File[] to the workspace.
 */
export function SampleRunner({ onSample, label }: SampleRunnerProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { samples } = await getSamples();
      if (samples.length === 0) {
        toast(copy.noSamples, 'error');
        return;
      }
      const sample = samples.find((s) => s.kind === 'pdf') ?? samples[0];
      const blob = await fetchSample(sample.name);
      const file = new File([blob], sample.name, {
        type: blob.type || 'application/octet-stream',
      });
      onSample([file]);
    } catch {
      toast(copy.sampleFailed, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={busy}
      style={{
        padding: '8px 14px',
        borderRadius: '8px',
        border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
        background: 'transparent',
        color: 'var(--color-foreground, #E9F6EE)',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 600,
      }}
    >
      {busy ? copy.sampleLoading : label ?? copy.trySample}
    </button>
  );
}