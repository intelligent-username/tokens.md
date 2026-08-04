import { Download } from "@phosphor-icons/react";
import copy from "@/lib/copy";
import { cn } from "@/lib/utils/cn";

export interface DownloadButtonProps {
  /** Server URL (attachment endpoint). When set, renders an anchor. */
  url?: string;
  /** Inline text to download as a Blob (requires filename). */
  content?: string;
  filename?: string;
  label?: string;
  disabled?: boolean;
}

const buttonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-control border border-border bg-secondary/50 px-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Download action: a server URL anchor OR a client-side Blob download of
 * inline content. Per-file download.
 */
export function DownloadButton({ url, content, filename = "download.md", label, disabled }: DownloadButtonProps) {
  if (url) {
    return (
      <a
        href={url}
        download
        aria-disabled={disabled}
        onClick={(e) => {
          if (disabled) e.preventDefault();
        }}
        className={cn(buttonClass, disabled && "pointer-events-none opacity-50")}
      >
        <Download size={16} weight="regular" aria-hidden="true" />
        {label ?? copy.download}
      </a>
    );
  }

  const downloadBlob = () => {
    if (disabled || content === undefined) return;
    const blob = new Blob([content], { type: "text/markdown" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <button
      type="button"
      onClick={downloadBlob}
      disabled={disabled || content === undefined}
      className={buttonClass}
    >
      <Download size={16} weight="regular" aria-hidden="true" />
      {label ?? copy.download}
    </button>
  );
}