/**
 * Workspace-specific copy strings.
 */

export const convertedNFiles = (n: number) => `Converted ${n} files.`;
export const totalReceipt = (source: number, target: number, percent: number) => `TOTAL ${source} → ${target} tokens · ${percent}%`;
export const partialSummary = (done: number, failed: number) => `${done} of ${done + failed} converted. ${failed} failed.`;
export const cancelledSummary = (done: number, total: number) => `Cancelled — ${done} of ${total} converted.`;

export const mergedNFiles = (n: number) => `Merged ${n} files.`;
export const mergeFilenamePlaceholder = "merged.md";
export const tocLabel = "Table of contents";
export const dedupLabel = "Dedupe duplicate lines";
export const rawLabel = "Merge raw contents";
export const mergingProgress = (current: number, total: number, file: string) => `Merging ${current}/${total} — ${file}`;

export const inYourClipboard = "In your clipboard.";
export const clipConfirmation = (tokens: number, lines: number) => `${tokens} tokens · ${lines} lines`;
export const clipBlocked = "Clipboard blocked by the browser.";
export const copyManually = "Copy manually";

export const fetchPlaceholder = "https://example.com/article";
export const fetchInvalid = "That doesn't look like a URL.";
export const fetched = (title: string) => `Fetched ${title}.`;
export const fetchFailed = "Couldn't fetch that page.";

export const budgetLabel = "Token budget";
export const budgetPlaceholder = "4000";
export const budgetHint = "Output will be pruned to fit.";
export const fitsBudget = "Fits budget.";
export const budgetNoPrune = "fits budget (no pruning needed)";
export const budgetOver = "Still over budget.";
export const raiseCeilingTo = (n: number) => `Raise the ceiling to ${n}+.`;
export const willPrune = "Will prune to fit.";

export const budgetHeader = (source: number, target: number) => `[budget] ${source} → ${target} tokens`;
export const removedLicenseDisclaimers = (count: number, tokens: number) => `removed ${count} license disclaimers (−${tokens} tokens)`;
export const removedImageRefs = (count: number, tokens: number) => `removed ${count} image references (−${tokens} tokens)`;
export const truncatedFromEnd = (tokens: number) => `truncated ${tokens} tokens from end`;
export const finalFits = (tokens: number) => `final: ${tokens} tokens (fits budget)`;
export const finalOver = (tokens: number) => `final: ${tokens} tokens (still over budget)`;

export const deltaFootnote = "Before = raw file estimate.";

export const excludePlaceholder = "build/, *.lock";
export const invalidPattern = "That pattern won't parse.";
export const manifestBuilt = (n: number) => `Manifest built — ${n} files.`;

export const watchIdle = "Pick a folder to watch.";
export const watching = "Watching…";
export const reconnecting = "Reconnecting…";
export const watchStoppedSummary = (duration: string, converted: number, failed: number) => `Stopped. Watched ${duration} · ${converted} converted · ${failed} failed.`;
export const daemonStopped = "Daemon stopped.";
export const processExisting = "Process existing files";
export const clearLog = "Clear";
export const watchLogLabel = "Watch log";
