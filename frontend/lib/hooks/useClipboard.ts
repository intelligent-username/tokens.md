'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Clipboard copy with a textarea + execCommand fallback.
 * Returns 'blocked' when neither path works so the UI can offer
 * "Copy manually".
 */
export function useClipboard(): {
  copy: (text: string) => Promise<'ok' | 'blocked'>;
  copied: boolean;
} {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  const copy = useCallback(async (text: string): Promise<'ok' | 'blocked'> => {
    let ok = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok) ok = fallbackCopy(text);

    if (ok) {
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 2000);
    }
    return ok ? 'ok' : 'blocked';
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { copy, copied };
}

function fallbackCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}