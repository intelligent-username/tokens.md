'use client';

import { useRef, useLayoutEffect, useState } from 'react';
import type { FileMeta, MergeResponse } from '@/lib/api/types';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { FileMatrixRow } from './FileMatrixRow';
import { MergeFunnel, type FunnelGeom } from './FileFlowStream';
import type { ConvertItemWithSession } from './ResultClipButton';

export interface InputFileMatrixProps {
  files: File[];
  convertedMap: Record<string, ConvertItemWithSession>;
  uploadMetaMap: Record<string, FileMeta>;
  unconvertedFiles: File[];
  mergeMode: boolean;
  mergeResult: MergeResponse | null;
  running: boolean;
  sessionId: string | null;
  getFileKey: (file: File) => string;
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
}

export function InputFileMatrix({
  files,
  convertedMap,
  uploadMetaMap,
  unconvertedFiles,
  mergeMode,
  mergeResult,
  running,
  sessionId,
  getFileKey,
  onRemoveFile,
  onClearAll,
}: InputFileMatrixProps) {
  const [funnelGeom, setFunnelGeom] = useState<FunnelGeom | null>(null);
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);
  const rowBarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (!mergeMode || files.length === 0) return;
    const container = rowsContainerRef.current;
    if (!container) return;
    const bars = rowBarRefs.current
      .map((el) => el?.getBoundingClientRect())
      .filter((r): r is DOMRect => Boolean(r));
    if (bars.length === 0) return;
    const containerRect = container.getBoundingClientRect();
    setFunnelGeom({
      x0: bars[0].left - containerRect.left,
      x1: bars[0].right - containerRect.left,
      y0s: bars.map((r) => r.top + r.height / 2 - containerRect.top),
      midY:
        bars.reduce((a, r) => a + (r.top + r.height / 2), 0) / bars.length -
        containerRect.top,
      height: containerRect.height,
    });
  }, [mergeMode, files.length, mergeResult, running]);

  return (
    <div ref={rowsContainerRef} className="relative flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground px-0">
        <div className="flex items-center gap-3">
          {files.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              disabled={running}
              aria-label="Clear all input files"
              className="inline-flex h-6 items-center justify-center rounded-md bg-muted/70 px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60 transition-colors disabled:opacity-50 normal-case tracking-normal cursor-pointer leading-none"
            >
              Clear
            </button>
          )}
          <span className="leading-none">
            1. {files.length === 1 ? 'Input File' : 'Input Files'} ({files.length})
          </span>
        </div>
        <span className="leading-none">2. Converted Markdown</span>
      </div>

      {files.map((file, i) => {
        const key = getFileKey(file);
        const resultItem = convertedMap[key];
        const meta = uploadMetaMap[key];
        const isConverting = running && !resultItem && (unconvertedFiles.includes(file) || mergeMode);
        const isDone = Boolean(resultItem || mergeResult);

        return (
          <FileMatrixRow
            key={key}
            file={file}
            fileKey={key}
            resultItem={resultItem}
            meta={meta}
            isConverting={isConverting}
            isDone={isDone}
            mergeMode={mergeMode}
            sessionId={sessionId}
            onRemoveFile={() => onRemoveFile(i)}
            barRef={(el) => {
              rowBarRefs.current[i] = el;
            }}
          />
        );
      })}

      {funnelGeom && mergeMode ? (
        <MergeFunnel
          geom={funnelGeom}
          active={running && !mergeResult}
          reduced={reducedMotion}
        />
      ) : null}
    </div>
  );
}
