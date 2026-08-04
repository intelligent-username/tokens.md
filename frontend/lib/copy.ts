/**
 * Single source of copy for the tokens.md web workbench.
 * Every visible string from ux-flows.md §3 (plus §8 first-run and §9 edge
 * cases) is exported here as a named constant or template function.
 * Voice: terse, confident, zero filler. No emoji, no AI-filler.
 */

// --- Shared controls -------------------------------------------------------

export const wordmark = 'tokens.md';
export const tagline = 'files → LLM-ready Markdown';
export const backToBench = '‹ Bench';

export const convertNFiles = (n: number) => `Convert ${n} files`;
export const mergeNFiles = (n: number) => `Merge ${n} files`;
export const fitNFilesToBudget = (n: number) => `Fit ${n} files to budget`;

export const convertIdle = 'Convert';
export const mergeIdle = 'Merge';
export const copyIdle = 'Copy';
export const fetchIdle = 'Fetch';
export const buildManifest = 'Build manifest';
export const analyzeIdle = 'Analyze';
export const fitToBudget = 'Fit to budget';

export const convertingBusy = 'Converting…';
export const mergingBusy = 'Merging…';
export const copyingBusy = 'Copying…';
export const fetchingBusy = 'Fetching…';
export const scanningBusy = 'Scanning…';
export const analyzingBusy = 'Analyzing…';

export const browse = 'Browse';
export const pickFolder = 'Pick a folder';

export const download = 'Download';
export const downloadAll = 'Download all (.zip)';
export const downloadConverted = (n: number) => `Download converted (${n})`;

export const copyMarkdown = 'Copy markdown';
export const copied = 'Copied.';

export const preview = 'Preview';
export const hidePreview = 'Hide preview';

export const retry = 'Retry';
export const remove = 'Remove';
export const removeFile = (name: string) => `Remove ${name}`;
export const close = 'Close';
export const closePreview = 'Close preview';

export const cancel = 'Cancel';
export const cancelling = 'Cancelling…';
export const stop = 'Stop';
export const start = 'Start';
export const startWatching = 'Start watching';
export const stopping = 'Stopping…';
export const starting = 'Starting…';

export const showMore = 'Show more';

// ----------------------------------------------------------------- Drop zone

export const dropFilesHere = 'Drop files here';
export const dropFilesSubline =
  'PDF, DOCX, XLSX, PPTX, EPUB, HTML, images, JSON, CSV, TXT — or browse';
export const dropFolderHere = 'Upload Files or Folders';
export const dropFolderSubline = 'PDFs, Office Documents, Structured Data, Code, or Folders';
export const releaseToConvert = 'Release to convert';
export const releaseToBuildManifest = 'Release to build manifest';
export const skippedUnsupported = (n: number) => `Skipped ${n} unsupported files`;
export const noSupportedFiles = 'No supported files found.';

// ------------------------------------------------------- Workspace-specific

export const convertedNFiles = (n: number) => `Converted ${n} files.`;
export const totalReceipt = (source: number, target: number, percent: number) =>
  `TOTAL ${source} → ${target} tokens · ${percent}%`;
export const partialSummary = (done: number, failed: number) =>
  `${done} of ${done + failed} converted. ${failed} failed.`;
export const cancelledSummary = (done: number, total: number) =>
  `Cancelled — ${done} of ${total} converted.`;

export const mergedNFiles = (n: number) => `Merged ${n} files.`;
export const mergeFilenamePlaceholder = 'merged.md';
export const tocLabel = 'Table of contents';
export const dedupLabel = 'Dedupe duplicate lines';
export const rawLabel = 'Merge raw contents';
export const mergingProgress = (current: number, total: number, file: string) =>
  `Merging ${current}/${total} — ${file}`;

export const inYourClipboard = 'In your clipboard.';
export const clipConfirmation = (tokens: number, lines: number) =>
  `${tokens} tokens · ${lines} lines`;
export const clipBlocked = 'Clipboard blocked by the browser.';
export const copyManually = 'Copy manually';

export const fetchPlaceholder = 'https://example.com/article';
export const fetchInvalid = "That doesn't look like a URL.";
export const fetched = (title: string) => `Fetched ${title}.`;
export const fetchFailed = "Couldn't fetch that page.";

export const budgetLabel = 'Token budget';
export const budgetPlaceholder = '4000';
export const budgetHint = 'Output will be pruned to fit.';
export const fitsBudget = 'Fits budget.';
export const budgetNoPrune = 'fits budget (no pruning needed)';
export const budgetOver = 'Still over budget.';
export const raiseCeilingTo = (n: number) => `Raise the ceiling to ${n}+.`;
export const willPrune = 'Will prune to fit.';

// CLI-verbatim prune report lines (ux-flows §2.5)
export const budgetHeader = (source: number, target: number) =>
  `[budget] ${source} → ${target} tokens`;
export const removedLicenseDisclaimers = (count: number, tokens: number) =>
  `removed ${count} license disclaimers (−${tokens} tokens)`;
export const removedImageRefs = (count: number, tokens: number) =>
  `removed ${count} image references (−${tokens} tokens)`;
export const truncatedFromEnd = (tokens: number) =>
  `truncated ${tokens} tokens from end`;
export const finalFits = (tokens: number) => `final: ${tokens} tokens (fits budget)`;
export const finalOver = (tokens: number) =>
  `final: ${tokens} tokens (still over budget)`;

export const deltaFootnote = 'Before = raw file estimate.';

export const excludePlaceholder = 'build/, *.lock';
export const invalidPattern = "That pattern won't parse.";
export const manifestBuilt = (n: number) => `Manifest built — ${n} files.`;

export const watchIdle = 'Pick a folder to watch.';
export const watching = 'Watching…';
export const reconnecting = 'Reconnecting…';
export const watchStoppedSummary = (duration: string, converted: number, failed: number) =>
  `Stopped. Watched ${duration} · ${converted} converted · ${failed} failed.`;
export const daemonStopped = 'Daemon stopped.';
export const processExisting = 'Process existing files';
export const clearLog = 'Clear';
export const watchLogLabel = 'Watch log';

// ------------------------------------------------------- Global errors/banners

export const backendOffline = 'Backend offline.';
export const retryConnection = 'Retry connection';
export const connectionLost = 'Connection lost. Retrying…';
export const missingDependency = 'A backend component is missing — reinstall the backend.';
export const missingDependencyDetail = 'Details';
export const largeFile = 'Large file — this may take a while.';
export const uploadFailed = (name: string) => `Upload failed for ${name}.`;
export const conversionFailed = (name: string) => `Failed to convert ${name}.`;
export const unsupportedFormat = (ext: string) => `Can't read ${ext} — unsupported.`;

// ------------------------------------------------------------- First-run (§8)

export const noConversionsYet = 'No conversions yet.';
export const trySample = 'Try a sample';
export const sampleLoading = 'Loading…';
export const noSamples = 'No samples available.';
export const sampleFailed = "Couldn't load a sample.";

export const dropFilesToConvert = 'Drop files to convert.';
export const dropFilesForSavings = 'Drop files to see token savings.';
export const pasteUrlToFetch = 'Paste a URL to fetch.';
export const dropRepoFolder = 'Drop a repo folder to build a manifest.';
export const pickFolderToWatch = 'Pick a folder to watch.';
export const setCeilingDropFiles = 'Set a ceiling. Drop files to fit.';

// --------------------------------------------------------------- Edge cases (§9)

export const previousJobEnded = 'Previous job ended — outputs were not saved.';
export const fileDisappeared = 'File disappeared during conversion.';
export const nothingOnThatPage = 'Nothing much on that page.';
export const ceilingMin = 'Ceiling must be at least 1.';
export const downloadFailed = 'Download failed.';
export const noFilesInFolder = 'No files found in this folder.';
export const largeRepoWarning = 'Large repo — this upload may take a while.';
export const uploadingN = (current: number, total: number) => `Uploading ${current}/${total}`;
export const scanning = (n: number) => `Scanning… ${n} files`;
export const sortedByHint = 'sorted by name';
export const tooLargeFile = 'That file is too large to upload.';

// ------------------------------------------------------- Next-step guidance (§5.1)

export const nextStepRemoveFile = 'Remove it and convert the rest.';
export const nextStepRetryReinstall = 'Retry after reinstall.';
export const nextStepRetry = 'Retry.';
export const nextStepCopyManually = 'Copy manually.';
export const nextStepRaiseCeiling = 'Raise the ceiling.';
export const nextStepDownloadConverted = 'Download what converted.';
export const nextStepDropOther = 'Drop different files or try a sample.';
export const nextStepFixUrl = 'Check the URL and try again.';

/**
 * Convenience default export so components can `import { copy } from '@/lib/copy'`.
 * Mirrors every named export above.
 */
const copy = {
  wordmark,
  tagline,
  backToBench,
  convertNFiles,
  mergeNFiles,
  fitNFilesToBudget,
  convertIdle,
  mergeIdle,
  copyIdle,
  fetchIdle,
  buildManifest,
  analyzeIdle,
  fitToBudget,
  convertingBusy,
  mergingBusy,
  copyingBusy,
  fetchingBusy,
  scanningBusy,
  analyzingBusy,
  browse,
  pickFolder,
  download,
  downloadAll,
  downloadConverted,
  copyMarkdown,
  copied,
  preview,
  hidePreview,
  retry,
  remove,
  removeFile,
  close,
  closePreview,
  cancel,
  cancelling,
  stop,
  start,
  startWatching,
  stopping,
  starting,
  showMore,
  dropFilesHere,
  dropFilesSubline,
  dropFolderHere,
  dropFolderSubline,
  releaseToConvert,
  releaseToBuildManifest,
  skippedUnsupported,
  noSupportedFiles,
  convertedNFiles,
  totalReceipt,
  partialSummary,
  cancelledSummary,
  mergedNFiles,
  mergeFilenamePlaceholder,
  tocLabel,
  dedupLabel,
  rawLabel,
  mergingProgress,
  inYourClipboard,
  clipConfirmation,
  clipBlocked,
  copyManually,
  fetchPlaceholder,
  fetchInvalid,
  fetched,
  fetchFailed,
  budgetLabel,
  budgetPlaceholder,
  budgetHint,
  fitsBudget,
  budgetNoPrune,
  budgetOver,
  raiseCeilingTo,
  willPrune,
  budgetHeader,
  removedLicenseDisclaimers,
  removedImageRefs,
  truncatedFromEnd,
  finalFits,
  finalOver,
  deltaFootnote,
  excludePlaceholder,
  invalidPattern,
  manifestBuilt,
  watchIdle,
  watching,
  reconnecting,
  watchStoppedSummary,
  daemonStopped,
  processExisting,
  clearLog,
  watchLogLabel,
  backendOffline,
  retryConnection,
  connectionLost,
  missingDependency,
  missingDependencyDetail,
  largeFile,
  uploadFailed,
  conversionFailed,
  unsupportedFormat,
  noConversionsYet,
  trySample,
  sampleLoading,
  noSamples,
  sampleFailed,
  dropFilesToConvert,
  dropFilesForSavings,
  pasteUrlToFetch,
  dropRepoFolder,
  pickFolderToWatch,
  setCeilingDropFiles,
  previousJobEnded,
  fileDisappeared,
  nothingOnThatPage,
  ceilingMin,
  downloadFailed,
  noFilesInFolder,
  largeRepoWarning,
  uploadingN,
  scanning,
  sortedByHint,
  tooLargeFile,
  nextStepRemoveFile,
  nextStepRetryReinstall,
  nextStepRetry,
  nextStepCopyManually,
  nextStepRaiseCeiling,
  nextStepDownloadConverted,
  nextStepDropOther,
  nextStepFixUrl,
};

export default copy;