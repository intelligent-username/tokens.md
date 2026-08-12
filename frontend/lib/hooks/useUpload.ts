"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface FileProgress {
  name: string;
  totalBytes: number;
  uploadedBytes: number;
  percent: number;
  done: boolean;
  failed?: string;
}

export interface UploadProgress {
  /** Files finished (count), matching "Uploading 3/5". */
  uploaded: number;
  total: number;
  /** Byte-weighted percent for determinate bars. */
  percent: number;
  done: boolean;
}

/**
 * Report handed to the upload runner. B3's lib/api/upload.ts uses
 * signal for abortable fetches and advance()/fail() to feed progress.
 */
export interface UploadReport {
  signal: AbortSignal;
  start: (index: number, totalBytes: number) => void;
  advance: (index: number, uploadedBytes: number) => void;
  fail: (index: number, error: string) => void;
}

/**
 * Upload progress state. Per-file progress is keyed by index into `files`.
 * upload(runner) runs the actual multipart work; cancel() aborts it.
 */
export function useUpload(files: File[]): {
  progress: UploadProgress;
  perFile: Record<number, FileProgress>;
  upload: (runner: (report: UploadReport) => Promise<void>) => Promise<void>;
  cancel: () => void;
} {
  const [perFile, setPerFile] = useState<Record<number, FileProgress>>({});
  const controllerRef = useRef<AbortController | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  const upload = useCallback(async (runner: (report: UploadReport) => Promise<void>) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const base: Record<number, FileProgress> = {};
    filesRef.current.forEach((file, index) => {
      base[index] = {
        name: file.name,
        totalBytes: file.size,
        uploadedBytes: 0,
        percent: 0,
        done: false,
      };
    });
    setPerFile(base);

    const report: UploadReport = {
      signal: controller.signal,
      start: (index, totalBytes) =>
        setPerFile((prev) => ({
          ...prev,
          [index]: {
            name: prev[index]?.name ?? filesRef.current[index]?.name ?? "",
            totalBytes,
            uploadedBytes: 0,
            percent: 0,
            done: false,
          },
        })),
      advance: (index, uploadedBytes) =>
        setPerFile((prev) => {
          const current = prev[index];
          if (!current) return prev;
          const done = current.totalBytes > 0 && uploadedBytes >= current.totalBytes;
          const percent = current.totalBytes > 0 ? Math.min(100, Math.round((uploadedBytes / current.totalBytes) * 100)) : done ? 100 : 0;
          return { ...prev, [index]: { ...current, uploadedBytes, percent, done } };
        }),
      fail: (index, error) =>
        setPerFile((prev) => {
          const current = prev[index];
          if (!current) return prev;
          return { ...prev, [index]: { ...current, failed: error } };
        }),
    };

    try {
      await runner(report);
    } finally {
      controllerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const progress = useMemo<UploadProgress>(() => {
    const entries = Object.values(perFile);
    const total = entries.reduce((sum, e) => sum + e.totalBytes, 0);
    const uploadedBytes = entries.reduce((sum, e) => sum + e.uploadedBytes, 0);
    const finished = entries.filter((e) => e.done || e.failed).length;
    return {
      uploaded: finished,
      total: files.length,
      percent: total > 0 ? Math.round((uploadedBytes / total) * 100) : 0,
      done: entries.length > 0 && finished === entries.length,
    };
  }, [perFile, files.length]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    []
  );

  return { progress, perFile, upload, cancel };
}
