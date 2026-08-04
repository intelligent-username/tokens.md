import type { CSSProperties, ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  padding: '32px 20px',
  borderRadius: 'var(--radius-card)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-card)',
  textAlign: 'center',
};

const iconStyle: CSSProperties = {
  display: 'inline-flex',
  color: 'var(--color-muted-foreground)',
  opacity: 0.8,
};

const titleStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '16px',
  fontWeight: 700,
  color: 'var(--color-foreground)',
};

const bodyStyle: CSSProperties = {
  fontSize: '13px',
  lineHeight: '1.5',
  color: 'var(--color-muted-foreground)',
};

/**
 * Centered glass empty state. Rendered when a pane has no data yet.
 * Copy strings must come from lib/copy.ts.
 */
export function EmptyState({ icon, title, body }: EmptyStateProps) {
  return (
    <div style={containerStyle}>
      {icon ? <span style={iconStyle}>{icon}</span> : null}
      <div style={titleStyle}>{title}</div>
      {body ? <div style={bodyStyle}>{body}</div> : null}
    </div>
  );
}
