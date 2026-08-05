'use client';

import type { CSSProperties } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '6px',
  cursor: 'pointer',
};

const textStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  flex: '1 1 auto',
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-foreground)',
};

const descStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-muted-foreground)',
};

const trackStyle: CSSProperties = {
  position: 'relative',
  flex: '0 0 auto',
  width: '36px',
  height: '20px',
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
};

const thumbStyle: CSSProperties = {
  position: 'absolute',
  top: '2px',
  left: '2px',
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  transition: 'transform 0.2s ease',
};

/**
 * Accessible switch. Emerald when on, secondary surface when off.
 */
export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <div style={rowStyle} aria-disabled={disabled}>
      <span style={textStyle}>
        <span style={labelStyle}>{label}</span>
        {description ? <span style={descStyle}>{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          ...trackStyle,
          background: checked ? 'var(--color-primary)' : 'var(--color-secondary)',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span
          style={{
            ...thumbStyle,
            transform: checked ? 'translateX(14px)' : 'translateX(0)',
            background: checked
              ? 'var(--color-primary-foreground)'
              : 'var(--color-secondary-foreground)',
          }}
        />
      </button>
    </div>
  );
}
