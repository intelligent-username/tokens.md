import copy from "@/lib/copy";
import { FileChip, formatBytes, type FileChipStatus, type TokenDelta } from "./FileChip";

/** Shape of the queue entries the workspaces hand to FileList. */
export interface FileChipData {
  id: string;
  name: string;
  size: number;
  status: FileChipStatus;
  delta?: TokenDelta;
}

export interface FileListProps {
  files: FileChipData[];
  onRemove: (id: string) => void;
  onPreview?: (id: string) => void;
  onRetry?: (id: string) => void;
  emptyText?: string;
}

/**
 * Vertical list of FileChips with an "N files · M MB" header row.
 * Pure presentational; empty state is a muted note.
 */
export function FileList({ files, onRemove, onPreview, onRetry, emptyText }: FileListProps) {
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  if (files.length === 0) {
    return (
      <p className="rounded-card border border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        {emptyText ?? copy.dropFilesHere}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between px-1">
        <h4 className="text-sm font-semibold text-foreground">
          {files.length} {files.length === 1 ? "file" : "files"}
        </h4>
        <span className="font-mono text-xs text-muted-foreground">{formatBytes(totalBytes)}</span>
      </header>
      <ul className="flex flex-col gap-2">
        {files.map((file) => (
          <li key={file.id}>
            <FileChip
              name={file.name}
              size={file.size}
              status={file.status}
              delta={file.delta}
              onRemove={() => onRemove(file.id)}
              onRetry={onRetry ? () => onRetry(file.id) : undefined}
            >
              {onPreview ? (
                <button
                  type="button"
                  onClick={() => onPreview(file.id)}
                  className="text-xs font-medium text-emerald-500 underline-offset-2 hover:underline"
                >
                  {copy.preview}
                </button>
              ) : null}
            </FileChip>
          </li>
        ))}
      </ul>
    </section>
  );
}