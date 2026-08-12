'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Check, Copy, FileText } from '@phosphor-icons/react';
import copy from '@/lib/copy';
import { cn } from '@/lib/utils/cn';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

interface MarkdownPreviewProps {
  content?: string;
  loading?: boolean;
  error?: string;
  className?: string;
}

const shellStyle: CSSProperties = {
  borderRadius: '12px',
  border: '1px solid var(--color-border)',
  background: '#0B1220',
  padding: '24px',
  height: '100%',
  minHeight: '400px',
  display: 'flex',
  flexDirection: 'column',
};

const centerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
};

const scrollStyle: CSSProperties = {
  overflowY: 'auto',
  flex: 1,
  paddingRight: '8px',
};

const mdStyle: CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '15px',
  lineHeight: '1.75',
  color: '#E2E8F0',
  overflowWrap: 'break-word',
};

const inlineCodeStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.9em',
  padding: '2px 5px',
  borderRadius: 'var(--radius-chip)',
  background: 'var(--color-muted)',
  color: 'var(--color-accent-foreground)',
};

const blockCodeTextStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
};

const linkStyle: CSSProperties = {
  color: 'var(--color-primary)',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
};

const tableWrapStyle: CSSProperties = { overflowX: 'auto', margin: '12px 0' };
const tableStyle: CSSProperties = { borderCollapse: 'collapse', width: '100%', fontSize: '13px' };
const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '2px solid var(--color-border)',
  fontWeight: 700,
};
const tdStyle: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--color-border)',
};
const quoteStyle: CSSProperties = {
  margin: '12px 0',
  padding: '2px 14px',
  borderLeft: '3px solid var(--color-primary)',
  borderRadius: '0 var(--radius-control) var(--radius-control) 0',
  background: 'var(--color-muted)',
  color: 'var(--color-muted-foreground)',
};
const hrStyle: CSSProperties = { border: 'none', borderTop: '1px solid var(--color-border)', margin: '16px 0' };

/**
 * Sanitized Markdown renderer (react-markdown + remark-gfm + rehype-sanitize)
 * with a copy affordance on fenced code blocks and empty/loading/error states.
 */
export function MarkdownPreview({ content, loading, error, className }: MarkdownPreviewProps) {
  if (loading) {
    return (
      <div className={cn(className)} style={{ ...shellStyle, ...centerStyle }}>
        <LoadingState label={copy.sampleLoading} />
      </div>
    );
  }
  if (error) {
    return (
      <div className={cn(className)} style={{ ...shellStyle, ...centerStyle }}>
        <ErrorState message={error} />
      </div>
    );
  }
  if (!content) {
    return (
      <div className={cn(className)} style={{ ...shellStyle, ...centerStyle }}>
        <EmptyState
          icon={<FileText size={26} weight="regular" />}
          title={copy.noConversionsYet}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '400px',
        padding: '24px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        backgroundColor: '#070C15',
        color: '#E2E8F0',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
        <div style={mdStyle}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function extractText(node: ReactNode): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const props = node.props as { children?: ReactNode } | null;
    return extractText(props?.children);
  }
  return '';
}

function PreBlock(props: { children?: ReactNode }) {
  return <CodeBlock text={extractText(props.children)}>{props.children}</CodeBlock>;
}

function CodeText({ className, children, ...rest }: { className?: string; children?: ReactNode }) {
  const block = typeof className === 'string' && className.includes('language-');
  return (
    <code {...rest} className={className} style={block ? blockCodeTextStyle : inlineCodeStyle}>
      {children}
    </code>
  );
}

function CodeBlock({ text, children }: { text: string; children: ReactNode }) {
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

const components: Components = {
  pre: PreBlock,
  code: CodeText,
  a: ({ node: _node, children, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer" style={linkStyle}>
      {children}
    </a>
  ),
  table: ({ node: _node, children, ...props }) => (
    <div style={tableWrapStyle}>
      <table {...props} style={tableStyle}>
        {children}
      </table>
    </div>
  ),
  th: ({ node: _node, children, ...props }) => (
    <th {...props} style={thStyle}>
      {children}
    </th>
  ),
  td: ({ node: _node, children, ...props }) => (
    <td {...props} style={tdStyle}>
      {children}
    </td>
  ),
  blockquote: ({ node: _node, children, ...props }) => (
    <blockquote {...props} style={quoteStyle}>
      {children}
    </blockquote>
  ),
  hr: () => <hr style={hrStyle} />,
};
