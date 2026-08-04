"use client";

import { AnimatePresence, motion } from "motion/react";
import { useToasts } from "@/lib/hooks/useToast";
import { Toast } from "./Toast";

/**
 * Fixed bottom-right toast stack. Consumes B4's useToasts(); auto-dismiss
 * timing is owned by the ToastProvider.
 */
export function Toaster() {
  const { toasts, dismiss } = useToasts();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            <Toast kind={toast.kind} message={toast.message} onDismiss={() => dismiss(toast.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}