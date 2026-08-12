'use client';

import { useState, type ReactNode } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import copy from '@/lib/copy';
import { blockCodeTextStyle, inlineCodeStyle } from './styles';

export function extractText(node: ReactNode): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const props = node.props as { children?: ReactNode } | null;
    return extractText(props?.children);
  }
  return '';
}

export function PreBlock(props: { children?: ReactNode }) {
  return <CodeBlock text={extractText(props.children)}>{props.children}</CodeBlock>;
}

export function CodeText({ className, children, ...rest }: { className?: string; children?: ReactNode }) {
  const block = typeof className === 'string' && className.includes('language-');
  return (
    <code {...rest} className={className} style={block ? blockCodeTextStyle : inlineCodeStyle}>
      {children}
    </code>
  );
}

export function CodeBlock({ text, children }: { text: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      style={{
        margin: '12px 0',
        borderRadius: 'var(--radius-control)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-muted)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '6px 10px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-muted-foreground)',
          }}
        >
          code
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copy.copyMarkdown}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 8px',
            borderRadius: 'var(--radius-chip)',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-muted-foreground)',
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          {copied ? (
            <Check size={13} weight="regular" aria-hidden="true" />
          ) : (
            <Copy size={13} weight="regular" aria-hidden="true" />
          )}
          <span>{copied ? copy.copied : copy.copyMarkdown}</span>
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '12px',
          overflow: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          lineHeight: '1.6',
          color: 'var(--color-foreground)',
        }}
      >
        {children}
      </pre>
    </div>
  );
}
