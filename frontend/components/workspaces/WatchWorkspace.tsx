'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import copy from '@/lib/copy';
import { uploadFiles } from '@/lib/api/upload';
import type { UploadResponse } from '@/lib/api/types';
import { useUpload } from '@/lib/hooks/useUpload';
import { useWatchStream, type WatchStartOptions } from '@/lib/hooks/useWatchStream';
import { useTokenMeter } from '@/lib/hooks/useTokenMeter';
import { useToast } from '@/lib/hooks/useToast';
import { DropZone } from '@/components/ui/DropZone';
import { ConfigCard } from '@/components/ui/ConfigCard';
import { Select } from '@/components/ui/Select';
import { MergeButton } from '@/components/ui/MergeButton';
import { TokenFlowMeter } from '@/components/ui/TokenFlowMeter';
import { WatchLog } from '@/components/ux/WatchLog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

const rowStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '14px' };

const POLL_OPTIONS = [
  { value: '1', label: '1s' },
  { value: '2', label: '2s' },
  { value: '5', label: '5s' },
];

/**
 * Watch workspace: folder drop + poll interval + Start/Stop. Streams live
 * per-file status over WebSocket into a WatchLog with a running token meter.
 */
export function WatchWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [pendingStart, setPendingStart] = useState<WatchStartOptions | null>(null);

  const { toast } = useToast();
  const { upload } = useUpload(files);
  const stream = useWatchStream(sessionId ?? '');
  const meter = useTokenMeter(
    stream.totals?.source_tokens ?? 0,
    stream.totals?.target_tokens ?? 0,
    { converting: stream.status === 'watching' || stream.status === 'connecting' },
  );

  // Start once the session is ready (upload completes before start).
  useEffect(() => {
    if (sessionId && pendingStart) {
      const opts = pendingStart;
      setPendingStart(null);
      void stream.start(opts);
    }
  }, [sessionId, pendingStart, stream]);

  const uploadFolder = async (): Promise<string> => {
    let up: UploadResponse | null = null;
    await upload(async (report) => {
      up = await uploadFiles(
        files,
        files.map((f) => f.name),
        undefined,
        (loaded, total) => report.advance(0, loaded),
        report.signal,
      );
    });
    const sid = up!.session_id;
    setSessionId(sid);
    return sid;
  };

  const handleStart = async () => {
    setError(null);
    try {
      if (sessionId) {
        await stream.start({ poll_interval: pollInterval, once: false });
      } else {
        await uploadFolder();
        setPendingStart({ poll_interval: pollInterval, once: false });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.startWatching);
    }
  };

  const handleProcessExisting = async () => {
    setError(null);
    try {
      if (sessionId) {
        await stream.start({ poll_interval: pollInterval, once: true });
      } else {
        await uploadFolder();
        setPendingStart({ poll_interval: pollInterval, once: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.processExisting);
    }
  };

  const handleStop = async () => {
    try {
      await stream.stop();
      toast(copy.daemonStopped, 'info');
    } catch {
      setError(copy.daemonStopped);
    }
  };

  const onFiles = (next: File[]) => {
    setFiles(next);
    setError(null);
  };

  const watching = stream.status === 'watching' || stream.status === 'connecting';

  const done = stream.log.filter((l) => l.kind === 'done').length;
  const failed = stream.log.filter((l) => l.kind === 'error').length;
  const summary = copy.watchStoppedSummary('', done, failed);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <DropZone
        onFiles={onFiles}
        allowFolders
        disabled={watching}
        label={copy.dropFolderHere}
        hint={copy.pickFolderToWatch}
      />

      <ConfigCard title="Watch options">
        <div style={rowStyle}>
          <Select
            value={String(pollInterval)}
            onChange={(v) => setPollInterval(Number(v))}
            options={POLL_OPTIONS}
            label="Poll interval"
            disabled={watching}
          />
        </div>
      </ConfigCard>

      <div style={{ display: 'flex', gap: '10px' }}>
        {watching ? (
          <MergeButton onClick={() => void handleStop()} label={copy.stop} />
        ) : (
          <MergeButton
            onClick={() => void handleStart()}
            disabled={files.length === 0}
            label={copy.startWatching}
          />
        )}
      </div>

      <TokenFlowMeter
        state={meter.state}
        sourceTokens={meter.sourceTokens}
        targetTokens={meter.targetTokens}
      />

      {error ? <ErrorState message={error} onRetry={handleStart} /> : null}

      <WatchLog
        lines={stream.log}
        totals={stream.totals}
        status={stream.status}
        summary={summary}
        onClear={stream.clear}
        onProcessExisting={() => void handleProcessExisting()}
        canProcessExisting={files.length > 0}
      />

      {files.length === 0 && stream.log.length === 0 ? (
        <EmptyState title={copy.pickFolderToWatch} />
      ) : null}
    </div>
  );
}