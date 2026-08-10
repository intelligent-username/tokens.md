'use client';

import copy from '../../lib/copy';

interface InlineAlertProps {
  message: string;
  retry?: () => void;
  className?: string;
}

/**
 * Job-level inline error (ux-flows §5.1). role="alert".
 * Icon is a styled text glyph to avoid a compile-time dependency on the icon
 * package; swap for @phosphor-icons/react once installed.
 */
export function InlineAlert({ message, retry, className }: InlineAlertProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        borderRadius: '12px',
        border: '1px solid rgba(220,38,38,0.35)',
        background: 'rgba(220,38,38,0.10)',
        color: 'var(--color-destructive-foreground, #FDFBFA)',
        fontSize: '14px',
        lineHeight: '1.5',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: '0 0 auto',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(220,38,38,0.25)',
          fontWeight: 700,
          fontSize: '12px',
          marginTop: '1px',
        }}
      >
        !
      </span>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div>{message}</div>
        {retry ? (
          <button
            type="button"
            onClick={retry}
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(220,38,38,0.4)',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {copy.retry}
          </button>
        ) : null}
      </div>
    </div>
  );
}