'use client';

import copy from '../../lib/copy';

interface BannerProps {
  message: string;
  /** Optional collapsible detail (e.g. the CLI's install hint verbatim). */
  detail?: string;
  retry?: () => void;
  retryLabel?: string;
  variant?: 'offline' | 'warning';
}

/**
 * Systemic banner (backend offline / missing dependency), ux-flows §5.1.
 * role="alert"; the only global error surface.
 */
export function Banner({
  message,
  detail,
  retry,
  retryLabel = copy.retryConnection,
  variant = 'offline',
}: BannerProps) {
  const isOffline = variant === 'offline';
  const accent = isOffline ? 'rgba(220,38,38,0.45)' : 'rgba(242,201,76,0.4)';
  const background = isOffline ? 'rgba(220,38,38,0.12)' : 'rgba(242,201,76,0.08)';

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '12px',
        border: `1px solid ${accent}`,
        background,
        color: 'var(--color-foreground, #E9F6EE)',
        fontSize: '14px',
        lineHeight: '1.5',
        width: '100%',
      }}
    >
      <span
        aria-hidden="true"
        style={{ fontWeight: 700, color: isOffline ? '#FF8A8A' : '#F2C94C' }}
      >
        {isOffline ? '✕' : '⚠'}
      </span>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div>{message}</div>
        {detail ? (
          <details style={{ marginTop: '4px', fontSize: '13px', opacity: 0.85 }}>
            <summary style={{ cursor: 'pointer' }}>{copy.missingDependencyDetail}</summary>
            <pre style={{ marginTop: '6px', whiteSpace: 'pre-wrap' }}>{detail}</pre>
          </details>
        ) : null}
      </div>
      {retry ? (
        <button
          type="button"
          onClick={retry}
          style={{
            flex: '0 0 auto',
            padding: '8px 14px',
            borderRadius: '8px',
            border: `1px solid ${accent}`,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}