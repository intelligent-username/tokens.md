"use client";

import { useCallback, useMemo, useRef, useState } from "react";

export type WorkspaceStateName = "empty" | "idle" | "uploading" | "processing" | "streaming" | "success" | "partial-failure" | "error" | "cancelled";

export type QueueItemStatus = "queued" | "uploading" | "converting" | "done" | "failed" | "cancelled";

export interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  sourceTokens?: number;
  targetTokens?: number;
  status: QueueItemStatus;
  error?: string;
}

export interface WorkspaceHandlers {
  onRun?: (items: QueueItem[]) => void;
  onCancel?: (items: QueueItem[]) => void;
  onRetry?: (items: QueueItem[]) => void;
}

let itemSeq = 0;
const nextId = () => `item-${++itemSeq}`;

function toItems(files: File[]): QueueItem[] {
  return files.map((file) => ({
    id: nextId(),
    file,
    name: file.name,
    size: file.size,
    status: "queued" as const,
  }));
}

/** Derive the §4.2 machine state from item statuses. */
function deriveState(items: QueueItem[]): WorkspaceStateName {
  if (items.length === 0) return "empty";
  const statuses = new Set(items.map((i) => i.status));
  if (statuses.has("cancelled")) return "cancelled";
  if (statuses.has("uploading")) return "uploading";
  if (statuses.has("converting")) return "processing";
  if (statuses.has("failed")) {
    return statuses.has("done") ? "partial-failure" : "error";
  }
  if (statuses.has("done")) return "success";
  return "idle";
}

/**
 * Shared workspace state machine (ux-flows §4.2).
 * The workspace drives it by calling setQueue with updated QueueItems; the
 * machine derives its state from item statuses. run/cancel/retryFailed
 * transition the machine and fire the optional handlers.
 */
export function useWorkspaceState(
  initial: File[] = [],
  handlers?: WorkspaceHandlers
): {
  state: WorkspaceStateName;
  queue: QueueItem[];
  setQueue: (files: File[] | QueueItem[]) => void;
  run: () => void;
  cancel: () => void;
  retryFailed: () => void;
} {
  const [queue, setQueueState] = useState<QueueItem[]>(() => toItems(initial));
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const setQueue = useCallback((files: File[] | QueueItem[]) => {
    setQueueState(files.length > 0 && "file" in files[0] ? (files as QueueItem[]) : toItems(files as File[]));
  }, []);

  const run = useCallback(() => {
    const items = queue.map((item) => (item.status === "queued" || item.status === "failed" ? { ...item, status: "uploading" as const, error: undefined } : item));
    const active = items.filter((i) => i.status === "uploading" || i.status === "converting");
    handlersRef.current?.onRun?.(active);
    setQueueState(items);
  }, [queue]);

  const cancel = useCallback(() => {
    const items = queue.map((item) => (item.status === "queued" || item.status === "uploading" || item.status === "converting" ? { ...item, status: "cancelled" as const } : item));
    handlersRef.current?.onCancel?.(items);
    setQueueState(items);
  }, [queue]);

  const retryFailed = useCallback(() => {
    const items = queue.map((item) => (item.status === "failed" ? { ...item, status: "uploading" as const, error: undefined } : item));
    const failed = items.filter((i) => i.status === "uploading");
    handlersRef.current?.onRetry?.(failed);
    setQueueState(items);
  }, [queue]);

  const state = useMemo(() => deriveState(queue), [queue]);

  return { state, queue, setQueue, run, cancel, retryFailed };
}
