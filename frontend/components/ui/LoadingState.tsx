import type { CSSProperties } from 'react';
import { SpinnerGap } from '@phosphor-icons/react';

interface LoadingStateProps {
  label?: string;
  spinner?: boolean;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  minHeight: '80px',
  padding: '16px 24px',
  borderRadius: 'var(--radius-card)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-card)',
  width: '100%',
};

const labelStyle: CSSProperties = {
  fontSize: '14px',
  color: 'var(--color-muted-foreground)',
};

/**
 * Spinner + label for in-flight work. The spin keyframes are scoped to the
 * .tmd-spin class so reduced-motion (globals.css) can kill them.
 */
export function LoadingState({ label, spinner = true }: LoadingStateProps) {
  return (
    <div style={containerStyle} role="status" aria-live="polite">
      <style>{'@keyframes tmd-spin{to{transform:rotate(360deg)}}.tmd-spin{animation:tmd-spin .9s linear infinite}'}</style>
      {spinner ? (
        <SpinnerGap size={20} weight="regular" className="tmd-spin" style={{ color: 'var(--color-primary)' }} />
      ) : null}
      {label ? <span style={labelStyle}>{label}</span> : null}
    </div>
  );
}
