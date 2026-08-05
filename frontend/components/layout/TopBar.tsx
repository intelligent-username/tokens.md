"use client";

import { ThemeToggle } from "@/app/theme";
import type { HealthStatus } from "@/lib/hooks/useHealth";
import { cn } from "@/lib/utils/cn";

export interface TopBarProps {
  active?: string;
  onChange?: (id: any) => void;
  health: HealthStatus;
}

export function TopBar({ health }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo & Title */}
        <a href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <img
            src="/logo.svg"
            alt="tokens.md logo"
            className="h-9 w-auto object-contain glyph-glow"
          />
          <span className="font-display text-xl font-bold tracking-tight">
            <span className="text-foreground">tokens</span>
            <span className="text-emerald-400">.md</span>
          </span>
        </a>

        {/* Right Status Controls */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                health === "online" && "bg-emerald-500 shadow-[0_0_8px_#16DE81]",
                health === "booting" && "bg-muted-foreground/50 animate-pulse",
                health === "degraded" && "bg-amber-400",
                health === "offline" && "bg-destructive"
              )}
            />
            <span className="capitalize">{health}</span>
          </div>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}