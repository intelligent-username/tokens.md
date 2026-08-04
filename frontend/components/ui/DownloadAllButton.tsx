import { FileZip } from "@phosphor-icons/react";
import { downloadAllUrl } from "@/lib/api/endpoints";
import copy from "@/lib/copy";
import { cn } from "@/lib/utils/cn";

export interface DownloadAllButtonProps {
  sessionId: string;
  label?: string;
  disabled?: boolean;
}

/**
 * Server-side ZIP download via GET /api/files/{sessionId}/download-all.
 * No client-side JSZip; the backend builds the archive.
 */
export function DownloadAllButton({ sessionId, label, disabled }: DownloadAllButtonProps) {
  return (
    <a
      href={downloadAllUrl(sessionId)}
      download
      aria-disabled={disabled}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-control border border-border bg-secondary/50 px-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <FileZip size={16} weight="regular" aria-hidden="true" />
      {label ?? copy.downloadAll}
    </a>
  );
}