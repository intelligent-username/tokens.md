'use client';

import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { Files } from '@phosphor-icons/react';
import copy from '@/lib/copy';
import { ResultCard, type ResultStatus } from './ResultCard';
import { MarkdownPreview } from './MarkdownPreview';
import { EmptyState } from './EmptyState';

export interface ResultItem {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  status?: ResultStatus;
}

interface ResultsPaneProps {
  results: ResultItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  previewContent?: string;
  previewLoading?: boolean;
  previewError?: string;
}

const listShellStyle: CSSProperties = {
  height: '100%',
  minHeight: '0',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  paddingRight: '2px',
};

const previewShellStyle: CSSProperties = {
  height: '100%',
  minHeight: '0',
  display: 'flex',
  flexDirection: 'column',
};

const cardWrapStyle = (active: boolean): CSSProperties => ({
  borderRadius: 'var(--radius-card)',
  cursor: 'pointer',
  outline: active ? '2px solid var(--color-primary)' : 'none',
  outlineOffset: '1px',
});

/**
 * Results split-pane: left result-card list (keyboard-selectable), right
 * MarkdownPreview. Stacks on small screens.
 */
export function ResultsPane({
  results,
  activeId,
  onSelect,
  previewContent,
  previewLoading,
  previewError,
}: ResultsPaneProps) {
  const onKeyDown = (id: string) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-5" style={listShellStyle}>
        {results.length === 0 ? (
          <EmptyState icon={<Files size={26} weight="regular" />} title={copy.dropFilesToConvert} />
        ) : (
          results.map((r) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              aria-pressed={r.id === activeId}
              onClick={() => onSelect(r.id)}
              onKeyDown={onKeyDown(r.id)}
              style={cardWrapStyle(r.id === activeId)}
            >
              <ResultCard title={r.title} meta={r.meta} actions={r.actions} status={r.status}>
                {r.children}
              </ResultCard>
            </div>
          ))
        )}
      </div>
      <div className="lg:col-span-7" style={previewShellStyle}>
        <MarkdownPreview
          content={previewContent}
          loading={previewLoading}
          error={previewError}
          className="flex-1"
        />
      </div>
    </div>
  );
}
