"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import copy from "@/lib/copy";
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
import { TotalCompressionPill } from "../convert/ResultClipButton";
import { useConvertRunner } from "../convert/useConvertRunner";

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

  const convertedItems = files.map((f) => convertedMap[getFileKey(f)]).filter(Boolean);

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
        <AnimatePresence mode="wait" initial={false}>
          {activeMode === "upload" ? (
            <motion.div key="upload" initial={{ opacity: 0, y: 10, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.99 }} transition={{ duration: 0.2, ease: "easeOut" }}>
              <DropZone onFiles={onFiles} multiple allowFolders disabled={running} />
            </motion.div>
          ) : (
            <motion.div key="input" initial={{ opacity: 0, y: 10, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.99 }} transition={{ duration: 0.2, ease: "easeOut" }}>
              <UrlInputCard value={inputUrl} onChange={setInputUrl} onSubmit={run} />
            </motion.div>
          )}
        </AnimatePresence>

        <MergeButton onClick={run} disabled={(activeMode === "upload" && files.length === 0) || (activeMode === "input" && !inputUrl.trim()) || running} loading={running} label={getButtonLabel()} />
      </div>

      {error ? <ErrorState message={error} onRetry={run} /> : null}

      {/* Side-by-Side Matched File Flow Rows */}
      {files.length > 0 && activeMode === "upload" ? (
        <InputFileMatrix files={files} convertedMap={convertedMap} uploadMetaMap={uploadMetaMap} unconvertedFiles={unconvertedFiles} mergeMode={mergeMode} mergeResult={mergeResult} running={running} sessionId={sessionId} getFileKey={getFileKey} onRemoveFile={onRemoveFile} onClearAll={onClearAll} />
      ) : null}

      {/* Input mode result row */}
      {activeMode === "input" && inputResult && sessionId ? <InputUrlResultCard inputResult={inputResult} inputUrl={inputUrl} sessionId={sessionId} /> : null}

      {/* Bottom Compression Summary Pill */}
      {running ? (
        activeMode === "upload" ? (
          <LoadingState label={copy.convertingBusy} spinner={false} />
        ) : null
      ) : activeMode === "upload" && mergeResult && sessionId ? (
        <MergeResultPill files={files} mergeResult={mergeResult} sessionId={sessionId} />
      ) : activeMode === "upload" && convertedItems.length > 0 && !mergeResult ? (
        <TotalCompressionPill sourceTokens={sourceTokensTotal} targetTokens={targetTokensTotal} percent={totalPercent} sessionId={sessionId || convertedItems[0]?.session_id || ""} isMerge={false} onCopyAll={() => handleCopyAll(convertedItems)} />
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
