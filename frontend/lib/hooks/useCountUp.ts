"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

export interface CountUpOptions {
  /** Duration in ms. Default 450 (contract: 400–500ms). */
  duration?: number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Eased count-up toward `target`. Instant when reduced motion is on.
 * Returns the current displayed value.
 */
export function useCountUp(target: number, opts?: CountUpOptions): number {
  const reduced = useReducedMotion();
  const duration = opts?.duration ?? 450;
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      prevRef.current = target;
      return;
    }
    const from = prevRef.current;
    if (from === target) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(from + (target - from) * easeOutCubic(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, reduced, duration]);

  return value;
}
