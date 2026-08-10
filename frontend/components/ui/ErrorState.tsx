'use client';

import type { CSSProperties } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import copy from '@/lib/copy';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '18px 20px',
  borderRadius: 'var(--radius-card)',
  border: '1px solid color-mix(in srgb, var(--color-destructive) 45%, transparent)',
  background: 'color-mix(in srgb, var(--color-destructive) 10%, transparent)',
  color: 'var(--color-destructive-foreground)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontWeight: 700,
};

const messageStyle: CSSProperties = {
  fontSize: '13px',
  lineHeight: '1.5',
  opacity: 0.92,
};

const retryStyle: CSSProperties = {
  alignSelf: 'flex-start',
  padding: '6px 14px',
  borderRadius: 'var(--radius-control)',
  border: '1px solid color-mix(in srgb, var(--color-destructive) 50%, transparent)',
  background: 'transparent',
  color: 'inherit',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

/**
 * Destructive-tinted error card, role="alert". Copy strings from lib/copy.ts.
 */
export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <WarningCircle size={18} weight="regular" aria-hidden="true" />
        <span>{title ?? copy.backendOffline}</span>
      </div>
      <div style={messageStyle}>{message}</div>
      {onRetry ? (
        <button type="button" onClick={onRetry} style={retryStyle}>
          {copy.retry}
        </button>
      ) : null}
    </div>
  );
}
