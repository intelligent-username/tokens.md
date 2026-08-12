"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (message: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

const noop = () => {};
const emptyToasts: Toast[] = [];

const ToastContext = createContext<ToastContextValue>({
  toasts: emptyToasts,
  toast: noop,
  dismiss: noop,
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ toasts: emptyToasts, toast: noop, dismiss: noop }), []);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): { toast: (message: string, kind?: ToastKind) => void } {
  return useMemo(() => ({ toast: noop }), []);
}

export function useToasts(): { toasts: Toast[]; dismiss: (id: number) => void } {
  return useMemo(() => ({ toasts: emptyToasts, dismiss: noop }), []);
}
