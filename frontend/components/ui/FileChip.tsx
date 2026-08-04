import type { ReactNode } from "react";
import { ArrowCounterClockwise, X } from "@phosphor-icons/react";
import { formatTokens } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** Compact human-readable byte size (e.g. "1.2 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${value >= 10 || exp === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exp]}`;
}

/** Statuses accepted from the workspace queue (superset of the four core ones). */
export type FileChipStatus =
  | "queued"
  | "uploading"
  | "converting"
  | "done"
  | "failed"
  | "cancelled"
  | "error";

/** Optional per-file token delta slot (before → after). */
export interface TokenDelta {
  before?: number;
  after?: number;
}

export interface FileChipProps {
  name: string;
  size: number;
  status?: FileChipStatus;
  delta?: TokenDelta;
  progress?: number;
  onRemove?: () => void;
  onRetry?: () => void;
  /** Optional slot below the chip (kept out of the primary layout). */
  children?: ReactNode;
}

const STATUS_LABEL: Record<FileChipStatus, string> = {
  done: "done",
  uploading: "uploading",
  converting: "converting",
  queued: "queued",
  failed: "failed",
  cancelled: "cancelled",
  error: "error",
};

/**
 * Compact glass pill: mono filename + size + status indicator + optional
 * token delta. Shows a remove button on hover and a retry button on failure.
 */
export function FileChip({
  name,
  size,
  status = "queued",
  delta,
  progress,
  onRemove,
  onRetry,
  children,
}: FileChipProps) {
  const failed = status === "failed" || status === "error" || status === "cancelled";

  return (
    <div className="group flex items-center gap-3 rounded-chip border border-border bg-secondary/40 px-3 py-2 transition-colors hover:bg-secondary">
      <span
        role="img"
        aria-label={STATUS_LABEL[status]}
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          status === "done" && "bg-emerald-500",
          (status === "uploading" || status === "converting") && "animate-pulse bg-amber-400",
          status === "queued" && "bg-muted-foreground/60",
          failed && "bg-destructive",
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-mono text-[13px] text-foreground">{name}</span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {formatBytes(size)}
          </span>
          {delta && typeof delta.before === "number" && typeof delta.after === "number" ? (
            <span className="shrink-0 font-mono text-xs text-emerald-500">
              {formatTokens(delta.before)} → {formatTokens(delta.after)}
            </span>
          ) : null}
        </div>
        {children ? <div className="mt-1">{children}</div> : null}
      </div>

      {(status === "uploading" || status === "converting") && progress !== undefined ? (
        <span className="font-mono text-xs text-amber-400" aria-label="progress">
          {Math.round(progress)}%
        </span>
      ) : null}

      {failed && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry"
          className="rounded-chip p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowCounterClockwise size={14} weight="regular" aria-hidden="true" />
        </button>
      ) : null}

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="rounded-chip p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X size={14} weight="regular" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
