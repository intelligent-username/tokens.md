import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";
import copy from "@/lib/copy";
import type { ToastKind } from "@/lib/hooks/useToast";
import { cn } from "@/lib/utils/cn";

export interface ToastProps {
  kind: ToastKind;
  message: string;
  onDismiss: () => void;
}

/** Single toast card. role=status for info/success, role=alert for errors. */
export function Toast({ kind, message, onDismiss }: ToastProps) {
  const Icon = kind === "success" ? CheckCircle : kind === "error" ? WarningCircle : Info;

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "glass pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-control p-4",
        kind === "error" ? "border-destructive/40" : "border-border",
      )}
    >
      <Icon
        size={18}
        weight="regular"
        aria-hidden="true"
        className={cn(
          "mt-0.5 shrink-0",
          kind === "success" && "text-emerald-500",
          kind === "error" && "text-destructive",
          kind === "info" && "text-muted-foreground",
        )}
      />
      <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={copy.close}
        className="shrink-0 rounded-chip p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X size={14} weight="regular" aria-hidden="true" />
      </button>
    </div>
  );
}