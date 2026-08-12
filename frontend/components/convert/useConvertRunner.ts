"use client";

import { useState } from "react";
import copy from "@/lib/copy";
import { convert, fetchUrl, merge } from "@/lib/api/endpoints";
import type { ConvertResponse, FileMeta, MergeResponse, UploadResponse } from "@/lib/api/types";
import { uploadFiles } from "@/lib/api/upload";
import { useClipboard } from "@/lib/hooks/useClipboard";
import { useJob } from "@/lib/hooks/useJob";
import { useToast } from "@/lib/hooks/useToast";
import { useUpload } from "@/lib/hooks/useUpload";
import { useWorkspaceState } from "@/lib/hooks/useWorkspaceState";
import type { BudgetUnit } from "@/components/ui/BudgetInput";
import type { ConvertItemWithSession } from "./ResultClipButton";
import { copyConvertedOutputs, copyMergedOutput } from "./runnerClipboard";
import { calculateBudgetTokens, formatTargetUrl, getFileKey } from "./runnerUtils";

export interface UseConvertRunnerOptions {
  activeMode: "upload" | "input";
  inputUrl: string;
  files: File[];
  setFiles: (files: File[]) => void;
  mergeEnabled: boolean;
  includeToc: boolean;
  budgetEnabled: boolean;
  budgetValue: number;
  budgetUnit: BudgetUnit;
  recursive: boolean;
  extensions: string;
  stripHeadersFooters: boolean;
  writeImages: boolean;
  pages: string;
}

export function useConvertRunner({ activeMode, inputUrl, files, setFiles, mergeEnabled, includeToc, budgetEnabled, budgetValue, budgetUnit, recursive, extensions, stripHeadersFooters, writeImages, pages }: UseConvertRunnerOptions) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [convertedMap, setConvertedMap] = useState<Record<string, ConvertItemWithSession>>({});
  const [uploadMetaMap, setUploadMetaMap] = useState<Record<string, FileMeta>>({});
  const [mergeResult, setMergeResult] = useState<MergeResponse | null>(null);
  const [inputResult, setInputResult] = useState<ConvertResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const { toast } = useToast();
  const { upload } = useUpload(files);
  const { subscribe } = useJob();
  const { copy: copyText } = useClipboard();

  const unconvertedFiles = files.filter((f) => !convertedMap[getFileKey(f)]);

  const { setQueue, run } = useWorkspaceState(files, {
    onRun: async () => {
      setRunning(true);
      setError(null);
      try {
        if (activeMode === "input" && inputUrl.trim()) {
          const targetUrl = formatTargetUrl(inputUrl);
          try {
            const res = await fetchUrl({
              url: targetUrl,
              user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            });
            const sid = res.session_id || "fetch-session";
            setSessionId(sid);
            setInputResult({
              results: [
                {
                  file_id: "fetch-1",
                  name: res.output_name || "fetched_article.md",
                  source_tokens: res.source_tokens ?? 0,
                  target_tokens: res.target_tokens ?? 0,
                  percent: res.percent ?? 0,
                  output_file_id: res.output_file_id,
                },
              ],
              converted_count: 1,
              failed_count: 0,
              total_source_tokens: res.source_tokens ?? 0,
              total_target_tokens: res.target_tokens ?? 0,
              total_percent: res.percent ?? 0,
            });
            toast("URL converted to Markdown", "success");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to fetch or convert URL");
          } finally {
            setRunning(false);
          }
          return;
        }

        if (mergeEnabled) {
          let up: UploadResponse | null = null;
          await upload(async (report) => {
            up = await uploadFiles(
              files,
              files.map((f) => f.name),
              undefined,
              (loaded) => report.advance(0, loaded),
              report.signal
            );
          });
          const sid = up!.session_id;
          setSessionId(sid);

          const mres = await merge({
            session_id: sid,
            file_ids: up!.files.map((f) => f.file_id),
            options: {
              recursive,
              no_toc: !includeToc,
              budget: calculateBudgetTokens(budgetEnabled, budgetValue, budgetUnit),
            },
          });
          setMergeResult(mres);
          toast(copy.mergedNFiles(files.length), "success");
        } else {
          const targetFiles = unconvertedFiles.length > 0 ? unconvertedFiles : files;
          if (targetFiles.length === 0) return;

          let up: UploadResponse | null = null;
          await upload(async (report) => {
            up = await uploadFiles(
              targetFiles,
              targetFiles.map((f) => f.name),
              undefined,
              (loaded) => report.advance(0, loaded),
              report.signal
            );
          });
          const sid = up!.session_id;
          setSessionId(sid);

          up!.files.forEach((fileMeta, i) => {
            const key = getFileKey(targetFiles[i]);
            setUploadMetaMap((prev) => ({ ...prev, [key]: fileMeta }));
          });

          const res = await convert({
            session_id: sid,
            file_ids: up!.files.map((f) => f.file_id),
            options: {
              recursive,
              strip_headers_footers: stripHeadersFooters,
              write_images: writeImages,
              pages: pages || undefined,
              extensions: extensions
                ? extensions
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : undefined,
            },
          });

          subscribe(`convert-${sid}`, sid);

          setConvertedMap((prev) => {
            const nextMap = { ...prev };
            res.results.forEach((item, idx) => {
              const fileObj = targetFiles[idx];
              if (fileObj) {
                const key = getFileKey(fileObj);
                nextMap[key] = {
                  ...item,
                  session_id: sid,
                };
              }
            });
            return nextMap;
          });

          toast(copy.convertedNFiles(res.results.length), "success");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : copy.conversionFailed(""));
      } finally {
        setRunning(false);
      }
    },
  });

  const onFiles = (next: File[]) => {
    const existing = new Set(files.map((f) => getFileKey(f)));
    const appended = next.filter((f) => !existing.has(getFileKey(f)));
    if (appended.length === 0) return;
    const merged = [...files, ...appended];
    setFiles(merged);
    setQueue(merged);
  };

  const onRemoveFile = (index: number) => {
    const fileToRemove = files[index];
    const nextFiles = files.filter((_, i) => i !== index);
    setFiles(nextFiles);
    setQueue(nextFiles);

    if (fileToRemove) {
      const key = getFileKey(fileToRemove);
      setConvertedMap((prev) => {
        const nextMap = { ...prev };
        delete nextMap[key];
        return nextMap;
      });
      setUploadMetaMap((prev) => {
        const nextMap = { ...prev };
        delete nextMap[key];
        return nextMap;
      });
    }
  };

  const onClearAll = () => {
    setFiles([]);
    setQueue([]);
    setConvertedMap({});
    setUploadMetaMap({});
    setMergeResult(null);
  };

  const handleCopyAll = async (convertedItems: ConvertItemWithSession[]) => {
    if (mergeResult && sessionId) {
      try {
        await copyMergedOutput(sessionId, mergeResult, copyText);
        toast("Merged Markdown copied to clipboard", "success");
      } catch {
        toast(copy.clipBlocked, "error");
      }
      return;
    }

    if (convertedItems.length === 0) return;

    try {
      await copyConvertedOutputs(convertedItems, sessionId, copyText);
      toast("All converted Markdown copied to clipboard", "success");
    } catch {
      toast(copy.clipBlocked, "error");
    }
  };

  return {
    sessionId,
    convertedMap,
    uploadMetaMap,
    mergeResult,
    inputResult,
    error,
    setError,
    running,
    getFileKey,
    unconvertedFiles,
    run,
    onFiles,
    onRemoveFile,
    onClearAll,
    handleCopyAll,
    setInputResult,
  };
}
