"use client";

import { useState, useEffect } from "react";
import { ThemeToggle } from "@/app/theme";
import type { HealthStatus } from "@/lib/hooks/useHealth";
import { cn } from "@/lib/utils/cn";

export interface TopBarProps {
  active?: string;
  onChange?: (id: any) => void;
  health: HealthStatus;
}

export function TopBar({ health }: TopBarProps) {
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    if (health === 'offline') {
      setShowOffline(true);
      return;
    }
    const timer = setTimeout(() => {
      if (health !== 'online') {
        setShowOffline(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [health]);

  const isOffline = health === 'offline' || (showOffline && health !== 'online');

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
          {isOffline ? (
            <div className="flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive animate-pulse">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span>API offline</span>
            </div>
          ) : null}

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}