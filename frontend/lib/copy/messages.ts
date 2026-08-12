/**
 * Errors, edge-cases, first-run, and guidance copy strings.
 */

export const backendOffline = "Backend offline.";
export const retryConnection = "Retry connection";
export const connectionLost = "Connection lost. Retrying…";
export const missingDependency = "A backend component is missing — reinstall the backend.";
export const missingDependencyDetail = "Details";
export const largeFile = "Large file — this may take a while.";
export const uploadFailed = (name: string) => `Upload failed for ${name}.`;
export const conversionFailed = (name: string) => `Failed to convert ${name}.`;
export const unsupportedFormat = (ext: string) => `Can't read ${ext} — unsupported.`;

export const noConversionsYet = "No conversions yet.";
export const trySample = "Try a sample";
export const sampleLoading = "Loading…";
export const noSamples = "No samples available.";
export const sampleFailed = "Couldn't load a sample.";

export const dropFilesToConvert = "Drop files to convert.";
export const dropFilesForSavings = "Drop files to see token savings.";
export const pasteUrlToFetch = "Paste a URL to fetch.";
export const dropRepoFolder = "Drop a repo folder to build a manifest.";
export const pickFolderToWatch = "Pick a folder to watch.";
export const setCeilingDropFiles = "Set a ceiling. Drop files to fit.";

export const previousJobEnded = "Previous job ended — outputs were not saved.";
export const fileDisappeared = "File disappeared during conversion.";
export const nothingOnThatPage = "Nothing much on that page.";
export const ceilingMin = "Ceiling must be at least 1.";
export const downloadFailed = "Download failed.";
export const noFilesInFolder = "No files found in this folder.";
export const largeRepoWarning = "Large repo — this upload may take a while.";
export const uploadingN = (current: number, total: number) => `Uploading ${current}/${total}`;
export const scanning = (n: number) => `Scanning… ${n} files`;
export const sortedByHint = "sorted by name";
export const tooLargeFile = "That file is too large to upload.";

export const nextStepRemoveFile = "Remove it and convert the rest.";
export const nextStepRetryReinstall = "Retry after reinstall.";
export const nextStepRetry = "Retry.";
export const nextStepCopyManually = "Copy manually.";
export const nextStepRaiseCeiling = "Raise the ceiling.";
export const nextStepDownloadConverted = "Download what converted.";
export const nextStepDropOther = "Drop different files or try a sample.";
export const nextStepFixUrl = "Check the URL and try again.";
