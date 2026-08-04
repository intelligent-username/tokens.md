"use client";

import { TokenGlyph, Wordmark } from "@/app/wordmark";
import { ThemeToggle } from "@/app/theme";
import type { HealthStatus } from "@/lib/hooks/useHealth";
import { cn } from "@/lib/utils/cn";
import { CommandNav, type CommandId } from "./CommandNav";

export interface TopBarProps {
  active: CommandId;
  onChange: (id: CommandId) => void;
  health: HealthStatus;
}

const HEALTH_DOT: Record<HealthStatus, string> = {
  online: "bg-emerald-500 shadow-glow",
  booting: "bg-muted-foreground/50",
  degraded: "bg-amber-400",
  offline: "bg-destructive",
};

/**
 * Sticky glass header: wordmark, command nav, backend health dot, theme
 * toggle. Health status is passed in from WorkbenchShell (single poller).
 */
export function TopBar({ active, onChange, health }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <a href="/" className="flex shrink-0 items-center gap-2" aria-label="tokens.md home">
          <TokenGlyph size={22} className="glyph-glow text-emerald-500" />
          <Wordmark />
        </a>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-3">
          <span
            role="status"
            title={`Backend ${health}`}
            aria-label={`Backend ${health}`}
            className={cn("h-2 w-2 rounded-full", HEALTH_DOT[health])}
          />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}