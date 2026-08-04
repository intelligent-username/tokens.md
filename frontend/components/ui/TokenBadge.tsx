import { formatTokens, deltaPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface TokenBadgeProps {
  before?: number;
  after?: number;
  /** Percent saved (positive = savings). Falls back to deltaPercent(before, after). */
  deltaPercent?: number;
  size?: "sm" | "md";
}

/**
 * Compact "before → after" token badge with a colored delta chip.
 * Emerald when tokens were saved, neutral at 0, red when they increased.
 */
export function TokenBadge({ before, after, deltaPercent: pct, size = "sm" }: TokenBadgeProps) {
  const percent =
    pct ?? (before !== undefined && after !== undefined ? deltaPercent(before, after) : 0);
  const saved = percent > 0;
  const increased = percent < 0;
  const sign = saved ? "−" : increased ? "+" : "";
  const label = `${sign}${Math.abs(percent).toFixed(1)}%`;

  return (
    <span className="inline-flex items-center gap-2">
      {before !== undefined && after !== undefined ? (
        <span
          className={cn(
            "font-mono tabular-nums text-muted-foreground",
            size === "md" ? "text-sm" : "text-xs",
          )}
        >
          {formatTokens(before)} → {formatTokens(after)}
        </span>
      ) : null}
      <span
        className={cn(
          "inline-flex items-center rounded-chip px-1.5 py-0.5 font-mono font-semibold tabular-nums",
          size === "md" ? "text-sm" : "text-xs",
          saved && "bg-accent text-accent-foreground",
          increased && "bg-destructive/15 text-red-600 dark:text-red-400",
          !saved && !increased && "bg-muted text-muted-foreground",
        )}
      >
        {label}
      </span>
    </span>
  );
}