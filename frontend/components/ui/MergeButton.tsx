import { Spinner } from "@phosphor-icons/react";
import copy from "@/lib/copy";
import { cn } from "@/lib/utils/cn";

export interface MergeButtonProps {
  label?: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/** Pick the busy copy that matches the idle label (all copy-sourced). */
function busyLabelFor(label: string | undefined): string {
  switch (label) {
    case copy.convertIdle:
      return copy.convertingBusy;
    case copy.mergeIdle:
      return copy.mergingBusy;
    case copy.copyIdle:
      return copy.copyingBusy;
    case copy.fetchIdle:
      return copy.fetchingBusy;
    case copy.buildManifest:
      return copy.scanningBusy;
    case copy.analyzeIdle:
    case copy.fitToBudget:
      return copy.analyzingBusy;
    default:
      return copy.mergingBusy;
  }
}

/**
 * Primary emerald action button. While loading it shows a spinner plus the
 * matching busy copy and is disabled.
 */
export function MergeButton({ label, onClick, loading = false, disabled = false }: MergeButtonProps) {
  const busy = disabled || loading;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 font-sans text-sm font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-emerald-400 active:bg-emerald-600",
        busy && "cursor-not-allowed opacity-60 hover:bg-primary active:bg-primary",
      )}
    >
      {loading ? (
        <Spinner size={16} weight="regular" className="animate-spin" aria-hidden="true" />
      ) : null}
      {loading ? busyLabelFor(label) : (label ?? copy.convertIdle)}
    </button>
  );
}