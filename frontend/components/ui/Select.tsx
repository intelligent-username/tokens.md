'use client';

import type { CSSProperties } from 'react';
import { CaretDown } from '@phosphor-icons/react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  label?: string;
  disabled?: boolean;
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '13px',
};

const labelStyle: CSSProperties = {
  fontWeight: 600,
  color: 'var(--color-muted-foreground)',
};

const wrapStyle: CSSProperties = {
  position: 'relative',
};

const selectStyle: CSSProperties = {
  width: '100%',
  appearance: 'none',
  WebkitAppearance: 'none',
  padding: '8px 30px 8px 10px',
  borderRadius: 'var(--radius-control)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-card)',
  color: 'var(--color-foreground)',
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  cursor: 'pointer',
};

const caretStyle: CSSProperties = {
  position: 'absolute',
  right: '10px',
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  color: 'var(--color-muted-foreground)',
};

/**
 * Native <select> styled to the glass theme. Value is always a string.
 */
export function Select({ value, onChange, options, label, disabled }: SelectProps) {
  return (
    <label style={fieldStyle}>
      {label ? <span style={labelStyle}>{label}</span> : null}
      <span style={wrapStyle}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={selectStyle}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <CaretDown size={14} weight="regular" style={caretStyle} aria-hidden="true" />
      </span>
    </label>
  );
}
