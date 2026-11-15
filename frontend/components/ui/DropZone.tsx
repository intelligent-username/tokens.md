"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { CloudArrowUp, FolderOpen, Spinner, WarningCircle } from "@phosphor-icons/react";
import copy from "@/lib/copy";
import { isSupported } from "@/lib/utils/extensions";
import { cn } from "@/lib/utils/cn";

/** Extra info passed alongside the accepted files. */
export interface DropMeta {
  /** Relative paths for folder drops (mirrors File.webkitRelativePath). */
  paths?: string[];
  /** File names skipped by client-side extension validation. */
  skipped?: string[];
}

export interface DropZoneVisualState {
  dragging: boolean;
  focused: boolean;
  busy: boolean;
  disabled: boolean;
}

export interface DropZoneProps {
  label?: string;
  sublabel?: string;
  accept?: string;
  multiple?: boolean;
  allowFolders?: boolean;
  disabled?: boolean;
  hint?: string;
  onFiles: (files: File[], meta?: DropMeta) => void;
  /** Noninteractive content only: this slot lives inside the picker button. */
  renderVisual?: (state: DropZoneVisualState) => ReactNode;
}

interface EntryItem {
  file: File;
  path: string;
}

function entryPath(entry: FileSystemEntry): string {
  return (entry.fullPath ?? "").replace(/^\/+/, "");
}

function readFileEntry(entry: FileSystemFileEntry): Promise<EntryItem> {
  return new Promise((resolve, reject) => {
    entry.file(
      (file) => resolve({ file, path: entryPath(entry) }),
      () => reject(new Error("unreadable entry"))
    );
  });
}

async function readDirectory(dir: FileSystemDirectoryEntry): Promise<EntryItem[]> {
  const reader = dir.createReader();
  const all: EntryItem[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) break;
    const nested = await Promise.all(batch.map(collectEntry));
    all.push(...nested.flat());
  }
  return all;
}

/** Recursively flatten a FileSystemEntry into File items (folders expanded). */
async function collectEntry(entry: FileSystemEntry): Promise<EntryItem[]> {
  if (entry.isFile) return [await readFileEntry(entry as FileSystemFileEntry)];
  if (entry.isDirectory) return readDirectory(entry as FileSystemDirectoryEntry);
  return [];
}

/**
 * Hero drop zone: files + folders (FileSystemEntry recursion with a
 * webkitdirectory fallback), drag-over highlight, keyboard activation, and
 * client-side extension validation. Unsupported files surface as an inline
 * skipped note rather than being silently dropped.
 */
export function DropZone({ label, sublabel, accept, multiple = true, allowFolders = false, disabled = false, hint, onFiles, renderVisual }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [announce, setAnnounce] = useState<string | null>(null);

  const heading = label ?? copy.dropFolderHere;
  const body = sublabel ?? copy.dropFolderSubline;

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  const acceptItems = (items: EntryItem[]) => {
    const supported = items.filter((i) => isSupported(i.file.name));
    const unsupported = items.filter((i) => !isSupported(i.file.name)).map((i) => i.file.name);
    setSkipped(unsupported);
    onFiles(
      supported.map((i) => i.file),
      { paths: supported.map((i) => i.path), skipped: unsupported }
    );
    if (supported.length === 0) setAnnounce(copy.noSupportedFiles);
    else if (unsupported.length > 0) setAnnounce(copy.skippedUnsupported(unsupported.length));
  };

  const acceptFiles = (files: File[]) => {
    acceptItems(files.map((f) => ({ file: f, path: f.webkitRelativePath || f.name })));
  };

  const handleItems = async (dt: DataTransfer) => {
    const entries = Array.from(dt.items)
      .filter((i) => i.kind === "file")
      .map((i) => i.webkitGetAsEntry())
      .filter((e): e is FileSystemEntry => Boolean(e));
    if (entries.length > 0) {
      setBusy(true);
      try {
        const items = (await Promise.all(entries.map(collectEntry))).flat();
        acceptItems(items);
      } finally {
        setBusy(false);
      }
      return;
    }
    acceptFiles(Array.from(dt.files));
  };

  const handleInputChange = () => {
    const input = inputRef.current;
    if (!input?.files) return;
    acceptFiles(Array.from(input.files));
    input.value = "";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    setDragging(false);
    void handleItems(e.dataTransfer);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={heading}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "group relative cursor-pointer rounded-card border-2 border-dashed border-border/80 glass transition-colors",
        renderVisual
          ? "grid min-w-0 grid-cols-1 items-center gap-4 p-4 sm:p-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-8"
          : "flex min-h-[280px] sm:min-h-[340px] flex-col items-center justify-center gap-4 p-8 sm:p-12 text-center",
        dragging ? "border-solid border-primary bg-accent" : "hover:border-primary",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>

      {renderVisual ? (
        <div className="min-w-0 w-full max-w-md justify-self-center">
          {renderVisual({ dragging, focused, busy, disabled })}
        </div>
      ) : busy ? (
        <Spinner size={28} weight="regular" className="animate-spin text-emerald-500" aria-hidden="true" />
      ) : (
        <span className="text-muted-foreground" aria-hidden="true">
          {allowFolders ? <FolderOpen size={32} weight="regular" /> : <CloudArrowUp size={32} weight="regular" />}
        </span>
      )}

      <div className={cn("flex flex-col gap-1", renderVisual && "min-w-0 text-center md:text-left")}>
        {renderVisual && busy ? (
          <span className="mb-2 inline-flex items-center justify-center gap-2 text-sm text-muted-foreground md:justify-start">
            <Spinner size={20} weight="regular" className="animate-spin text-primary" aria-hidden="true" />
            Scanning folder…
          </span>
        ) : null}
        <span className="font-display text-lg font-medium text-foreground">{heading}</span>
        <span className="text-sm text-muted-foreground">{body}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>

      {skipped.length > 0 ? (
        <span className={cn("inline-flex items-center gap-1 rounded-chip bg-destructive/10 px-2 py-1 text-xs text-destructive", renderVisual && "justify-self-center md:col-span-2")}>
          <WarningCircle size={16} weight="regular" aria-hidden="true" />
          {copy.skippedUnsupported(skipped.length)}
        </span>
      ) : null}

      <input ref={inputRef} type="file" className="sr-only" accept={accept} multiple={multiple} disabled={disabled} onChange={handleInputChange} {...(allowFolders ? ({ webkitdirectory: "", directory: "" } as Record<string, string>) : {})} />
    </div>
  );
}
