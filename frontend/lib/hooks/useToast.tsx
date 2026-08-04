'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastKind = 'info' | 'success' | 'error';

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

const ToastContext = createContext<ToastContextValue | null>(null);

let toastSeq = 0;

/**
 * Toast provider. Mount once (B3's providers.tsx). Powers B3's Toaster via
 * useToasts() and fires toasts via useToast().
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = ++toastSeq;
      setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
      const ms = kind === 'error' ? 6000 : 4000;
      const timer = window.setTimeout(() => dismiss(id), ms);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/** Fire a toast. */
export function useToast(): { toast: (message: string, kind?: ToastKind) => void } {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return useMemo(() => ({ toast: ctx.toast }), [ctx.toast]);
}

/** Read the toast list for rendering (used by B3's Toaster). */
export function useToasts(): { toasts: Toast[]; dismiss: (id: number) => void } {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToasts must be used within ToastProvider');
  return useMemo(
    () => ({ toasts: ctx.toasts, dismiss: ctx.dismiss }),
    [ctx.toasts, ctx.dismiss],
  );
}