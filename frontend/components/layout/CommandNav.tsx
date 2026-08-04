"use client";

import { useRef, type ComponentType, type KeyboardEvent } from "react";
import {
  ArrowsLeftRight,
  ChartLineUp,
  ClipboardText,
  Eye,
  Files,
  FolderOpen,
  Gauge,
  Globe,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

export type CommandId =
  | "convert"
  | "merge"
  | "clip"
  | "fetch"
  | "repo"
  | "watch"
  | "delta"
  | "budget";

interface CommandIconProps {
  size?: number;
  weight?: string;
  className?: string;
}

const COMMANDS: { id: CommandId; label: string; icon: ComponentType<CommandIconProps> }[] = [
  { id: "convert", label: "Convert", icon: ArrowsLeftRight },
  { id: "merge", label: "Merge", icon: Files },
  { id: "clip", label: "Clip", icon: ClipboardText },
  { id: "fetch", label: "Fetch", icon: Globe },
  { id: "repo", label: "Repo", icon: FolderOpen },
  { id: "watch", label: "Watch", icon: Eye },
  { id: "delta", label: "Delta", icon: ChartLineUp },
  { id: "budget", label: "Budget", icon: Gauge },
];

export interface CommandNavProps {
  active: CommandId;
  onChange: (id: CommandId) => void;
  disabled?: boolean;
}

/**
 * Segmented command switcher with roving tabindex and arrow-key navigation.
 * Active tab gets the emerald accent; Enter/Space activate via native button.
 */
export function CommandNav({ active, onChange, disabled }: CommandNavProps) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (next: number) => {
    const index = (next + COMMANDS.length) % COMMANDS.length;
    onChange(COMMANDS[index].id);
    buttonsRef.current[index]?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return;
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        move(index + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        move(index - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(COMMANDS.length - 1);
        break;
    }
  };

  return (
    <nav aria-label="Commands" className="flex items-center gap-1 overflow-x-auto">
      {COMMANDS.map(({ id, label, icon: Icon }, index) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(id)}
            onFocus={() => onChange(id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon size={15} weight="regular" aria-hidden="true" />
            {label}
            {isActive ? (
              <span
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-500"
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}