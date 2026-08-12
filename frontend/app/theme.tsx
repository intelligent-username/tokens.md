"use client";

import { Moon, SunDim } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const STORAGE_KEY = "tmd-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme, animate = true) {
  if (typeof document === "undefined") return;

  if (animate && "startViewTransition" in document) {
    try {
      const transition = (document as any).startViewTransition(() => {
        document.documentElement.classList.toggle("dark", theme === "dark");
      });
      if (transition) {
        if (typeof transition.ready?.catch === "function") {
          transition.ready.catch(() => {});
        }
        if (typeof transition.finished?.catch === "function") {
          transition.finished.catch(() => {});
        }
      }
    } catch {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  } else {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}

/**
 * React context provider for the app theme. Dark by default.
 * On mount it syncs with the stored value (falling back to
 * prefers-color-scheme, then dark). Children only, no DOM shell.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    let initialTheme: Theme = "dark";
    if (stored === "dark" || stored === "light") {
      initialTheme = stored;
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      initialTheme = "light";
    } else if (document.documentElement.classList.contains("dark")) {
      initialTheme = "dark";
    }
    setThemeState(initialTheme);
    applyTheme(initialTheme, false);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next, true);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next, true);
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Returns the current theme plus setTheme/toggle. Throws outside ThemeProvider. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

/** Accessible theme switch: animated sun in light mode, glowing moon in dark mode. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = theme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button type="button" role="switch" aria-checked={true} aria-label="Theme toggle" className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-control border border-border/80 bg-secondary/60 text-secondary-foreground shadow-sm" suppressHydrationWarning>
        <span className="flex items-center justify-center">
          <Moon size={18} weight="fill" className="text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]" />
        </span>
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
      whileTap={{ scale: 0.88, rotate: isDark ? -15 : 15 }}
      whileHover={{ scale: 1.08 }}
      className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-control border border-border/80 bg-secondary/60 text-secondary-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shadow-sm"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? "dark" : "light"}
          initial={{ y: -16, opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
          exit={{ y: 16, opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex items-center justify-center"
        >
          {isDark ? <Moon size={18} weight="fill" className="text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]" /> : <SunDim size={19} weight="duotone" className="text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" />}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}
