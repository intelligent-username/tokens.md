import type { CSSProperties, ReactNode } from 'react';

export type ResultStatus = 'queued' | 'converting' | 'done' | 'skipped' | 'error';

interface ResultCardProps {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  status?: ResultStatus;
}

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '14px 16px',
  borderRadius: 'var(--radius-card)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-card)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const titleStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: '0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: 600,
  fontSize: '14px',
  color: 'var(--color-foreground)',
};

const metaStyle: CSSProperties = {
  flex: '0 0 auto',
  fontSize: '12px',
  color: 'var(--color-muted-foreground)',
  fontVariantNumeric: 'tabular-nums',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flex: '0 0 auto',
};

const bodyStyle: CSSProperties = {
  fontSize: '13px',
  color: 'var(--color-muted-foreground)',
};

const DOT_COLOR: Record<ResultStatus, string> = {
  queued: 'var(--color-muted-foreground)',
  converting: 'var(--color-primary)',
  done: 'var(--color-accent-foreground)',
  skipped: 'var(--color-muted-foreground)',
  error: 'var(--color-destructive)',
};

/**
 * Glass result card: title + meta + status dot in the header row, actions in
 * a trailing slot, and children as the body.
 */
export function ResultCard({ title, meta, actions, children, status }: ResultCardProps) {
  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        {status ? (
          <span
            aria-hidden="true"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: DOT_COLOR[status],
              flex: '0 0 auto',
            }}
          />
        ) : null}
        <span style={titleStyle}>{title}</span>
        {meta ? <span style={metaStyle}>{meta}</span> : null}
        {actions ? <span style={actionsStyle}>{actions}</span> : null}
      </div>
      {children ? <div style={bodyStyle}>{children}</div> : null}
    </div>
  );
}
