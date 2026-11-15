"use client";

import { useMemo, useState } from "react";
import copy from "@/lib/copy";
import type { ConvertItem } from "@/lib/api/types";
import type { PreviewableOutput } from "@/lib/hooks/useMarkdownPreview";
import { extOf } from "@/lib/utils/extensions";
import { outputKey } from "@/lib/utils/markdownStructure";
import { DropZone } from "@/components/ui/DropZone";
import { MergeButton } from "@/components/ui/MergeButton";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { type BudgetUnit } from "@/components/ui/BudgetInput";

import { ModeSelector } from "../convert/ModeSelector";
import { UrlInputCard } from "../convert/UrlInputCard";
import { OptionsPanel } from "../convert/OptionsPanel";
import { InputFileMatrix } from "../convert/InputFileMatrix";
import { InputUrlResultCard } from "../convert/InputUrlResultCard";
import { MergeResultPill } from "../convert/MergeResultPill";
import { TotalCompressionPill, type ConvertItemWithSession } from "../convert/ResultClipButton";
import { useConvertRunner, type InputRunResult, type MergeRunResult } from "../convert/useConvertRunner";
import { ImpossibleManuscript, type ManuscriptPhase } from "../convert/ImpossibleManuscript";
import { MarkdownStructureExplorer } from "../convert/MarkdownStructureExplorer";

function hasSuccessfulOutput(item: ConvertItem): boolean {
  return Boolean(item.output_file_id?.trim()) && !item.error
    && (item.status === undefined || item.status === "done");
}

function getManuscriptOutputs({
  activeMode,
  mergeEnabled,
  files,
  convertedMap,
  getFileKey,
  merged,
  input,
}: {
  activeMode: "upload" | "input";
  mergeEnabled: boolean;
  files: readonly File[];
  convertedMap: Record<string, ConvertItemWithSession>;
  getFileKey: (file: File) => string;
  merged: MergeRunResult | null;
  input: InputRunResult | null;
}): PreviewableOutput[] {
  const outputs: PreviewableOutput[] = [];
  const seen = new Set<string>();
  const append = (output: PreviewableOutput) => {
    const key = outputKey(output);
    if (seen.has(key)) return;
    seen.add(key);
    outputs.push(output);
  };

  if (activeMode === "input") {
    if (input?.session_id?.trim()) {
      for (const item of input.results) {
        if (hasSuccessfulOutput(item) && item.output_file_id) {
          append({ sessionId: input.session_id, fileId: item.output_file_id, name: item.output_name ?? item.name });
        }
      }
    }
  } else if (mergeEnabled) {
    if (merged?.session_id?.trim() && merged.output_file_id?.trim()) {
      append({ sessionId: merged.session_id, fileId: merged.output_file_id, name: merged.output_name });
    }
  } else {
    for (const file of files) {
      const item = convertedMap[getFileKey(file)];
      if (item && hasSuccessfulOutput(item) && item.output_file_id && item.session_id?.trim()) {
        append({ sessionId: item.session_id, fileId: item.output_file_id, name: item.output_name ?? item.name });
      }
    }
  }
  return outputs;
}

/** Single workspace wrapper: side-by-side Before/After matched rows with incremental caching. */
export function ConvertWorkspace() {
  const [activeMode, setActiveMode] = useState<"upload" | "input">("upload");
  const [inputUrl, setInputUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  // Settings State
  const [mergeEnabled, setMergeEnabled] = useState(false);
  const [includeToc, setIncludeToc] = useState(true);
  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [budgetValue, setBudgetValue] = useState(100);
  const [budgetUnit, setBudgetUnit] = useState<BudgetUnit>("KB");
  const [recursive, setRecursive] = useState(true);
  const [extensions, setExtensions] = useState("");
  const [stripHeadersFooters, setStripHeadersFooters] = useState(false);
  const [writeImages, setWriteImages] = useState(false);
  const [pages, setPages] = useState("");

  const { sessionId, convertedMap, uploadMetaMap, mergeResult, inputResult, error, setError, running, getFileKey, unconvertedFiles, run, onFiles, onRemoveFile, onClearAll, handleCopyAll, setInputResult } = useConvertRunner({
    activeMode,
    inputUrl,
    files,
    setFiles,
    mergeEnabled,
    includeToc,
    budgetEnabled,
    budgetValue,
    budgetUnit,
    recursive,
    extensions,
    stripHeadersFooters,
    writeImages,
    pages,
  });

  const outputs = useMemo(() => getManuscriptOutputs({
    activeMode, mergeEnabled, files, convertedMap, getFileKey,
    merged: mergeResult, input: inputResult,
  }), [activeMode, mergeEnabled, files, convertedMap, getFileKey, mergeResult, inputResult]);
  const sourceExtensions = useMemo(
    () => activeMode === "upload" ? files.map((file) => extOf(file.name) || "File") : ["URL"],
    [activeMode, files],
  );
  const mergedSourceKeys = useMemo(
    () => new Set(mergeResult?.sourceFiles?.map(getFileKey)),
    [mergeResult, getFileKey],
  );
  const convertedItems = files.map((f) => convertedMap[getFileKey(f)]).filter(Boolean);
  const resultItems = activeMode === "input" ? inputResult?.results ?? [] : convertedItems;
  const itemFailures = resultItems.filter((item) => item.status === "error" || Boolean(item.error)).length;
  const mergeFailures = mergeResult?.delta_entries?.filter((item) => Boolean(item.error)).length ?? 0;
  const failedCount = activeMode === "input"
    ? Math.max(inputResult?.failed_count ?? 0, itemFailures)
    : mergeEnabled ? mergeFailures : itemFailures;
  const returnedCount = activeMode === "upload" && mergeEnabled
    ? mergeResult?.delta_entries?.length ?? 0
    : resultItems.length;
  const allFailed = failedCount > 0 && failedCount >= returnedCount && outputs.length === 0;
  const hasInputs = activeMode === "upload" ? files.length > 0 : Boolean(inputUrl.trim());
  const hasNewUnconvertedInputs = activeMode === "upload"
    ? files.some((file) => mergeEnabled
      ? !mergedSourceKeys.has(getFileKey(file))
      : !convertedMap[getFileKey(file)])
    : hasInputs && inputResult?.sourceUrl !== inputUrl.trim();
  const phase: ManuscriptPhase = running ? "converting"
    : error || allFailed ? "error"
    : hasNewUnconvertedInputs ? "selected"
    : outputs.length > 0 ? "complete"
    : hasInputs ? "selected"
    : "idle";
  const sourceCount = activeMode === "upload" ? files.length : Number(hasInputs);

  const sourceTokensTotal = mergeResult ? mergeResult.source_tokens : convertedItems.reduce((sum, item) => sum + (item.source_tokens ?? 0), 0);
  const targetTokensTotal = mergeResult ? mergeResult.target_tokens : convertedItems.reduce((sum, item) => sum + (item.target_tokens ?? 0), 0);
  const totalPercent = mergeResult ? mergeResult.percent : sourceTokensTotal > 0 ? ((sourceTokensTotal - targetTokensTotal) / sourceTokensTotal) * 100 : 0;

  const mergeMode = mergeEnabled || Boolean(mergeResult);

  const handleModeChange = (mode: "upload" | "input") => {
    setActiveMode(mode);
    setInputResult(null);
    setError(null);
  };

  const getButtonLabel = () => {
    if (activeMode === "input") return "Fetch & Convert";
    if (mergeEnabled) return "Merge All Files";
    if (unconvertedFiles.length > 0 && convertedItems.length > 0) {
      return `Convert (${unconvertedFiles.length} new)`;
    }
    if (unconvertedFiles.length === 0 && convertedItems.length > 0) {
      return "Re-convert All";
    }
    return copy.convertIdle;
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <ModeSelector activeMode={activeMode} onChange={handleModeChange} />

      {/* Top Upload/Input Control Section */}
      <div className="flex flex-col gap-4">
        {activeMode === "upload" ? (
          <DropZone
            onFiles={onFiles}
            multiple
            allowFolders
            disabled={running}
            renderVisual={({ dragging, focused, busy }) => (
              <ImpossibleManuscript
                phase={phase}
                engaged={dragging || focused || busy}
                sourceCount={sourceCount}
                sourceExtensions={sourceExtensions}
                outputCount={outputs.length}
              />
            )}
          />
        ) : (
          <UrlInputCard value={inputUrl} onChange={setInputUrl} onSubmit={run} />
        )}

        <MergeButton onClick={run} disabled={(activeMode === "upload" && files.length === 0) || (activeMode === "input" && !inputUrl.trim()) || running} label={getButtonLabel()} />
      </div>

      {error ? <ErrorState message={error} onRetry={run} /> : null}
      {failedCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          {failedCount} {failedCount === 1 ? "conversion" : "conversions"} failed.
          {allFailed ? " No Markdown output was produced. Review the results and retry." : null}
        </p>
      ) : null}

      {/* Side-by-Side Matched File Flow Rows */}
      {files.length > 0 && activeMode === "upload" ? (
        <InputFileMatrix files={files} convertedMap={convertedMap} uploadMetaMap={uploadMetaMap} unconvertedFiles={unconvertedFiles} mergeMode={mergeMode} mergeResult={mergeResult} running={running} sessionId={sessionId} getFileKey={getFileKey} onRemoveFile={onRemoveFile} onClearAll={onClearAll} />
      ) : null}

      {/* Input mode result row */}
      {activeMode === "input" && inputResult?.session_id?.trim() ? <InputUrlResultCard inputResult={inputResult} inputUrl={inputResult.sourceUrl ?? ""} sessionId={inputResult.session_id} /> : null}

      {/* Bottom Compression Summary Pill */}
      {running ? (
        activeMode === "upload" ? (
          <LoadingState label={copy.convertingBusy} spinner={false} />
        ) : null
      ) : activeMode === "upload" && mergeResult?.session_id?.trim() && mergeResult.sourceFiles ? (
        <MergeResultPill files={mergeResult.sourceFiles} mergeResult={mergeResult} sessionId={mergeResult.session_id} />
      ) : activeMode === "upload" && convertedItems.length > 0 && !mergeResult ? (
        <TotalCompressionPill sourceTokens={sourceTokensTotal} targetTokens={targetTokensTotal} percent={totalPercent} sessionId={sessionId || convertedItems[0]?.session_id || ""} isMerge={false} onCopyAll={() => handleCopyAll(convertedItems)} />
      ) : null}

      {outputs.length > 0 ? (
        <div className="min-w-0 space-y-3">
          {running || hasNewUnconvertedInputs || error ? (
            <p className="text-sm text-muted-foreground">Existing outputs</p>
          ) : null}
          <MarkdownStructureExplorer outputs={outputs} />
        </div>
      ) : null}

      <OptionsPanel
        extensions={extensions}
        setExtensions={setExtensions}
        pages={pages}
        setPages={setPages}
        budgetEnabled={budgetEnabled}
        setBudgetEnabled={setBudgetEnabled}
        budgetValue={budgetValue}
        setBudgetValue={setBudgetValue}
        budgetUnit={budgetUnit}
        setBudgetUnit={setBudgetUnit}
        recursive={recursive}
        setRecursive={setRecursive}
        stripHeadersFooters={stripHeadersFooters}
        setStripHeadersFooters={setStripHeadersFooters}
        writeImages={writeImages}
        setWriteImages={setWriteImages}
        mergeEnabled={mergeEnabled}
        setMergeEnabled={setMergeEnabled}
        includeToc={includeToc}
        setIncludeToc={setIncludeToc}
      />
    </div>
  );
}
