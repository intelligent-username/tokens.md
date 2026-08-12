"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import copy from "@/lib/copy";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: "0",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: "rgba(5, 10, 20, 0.85)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const panelStyle: CSSProperties = {
  position: "relative",
  width: "85vw",
  maxWidth: "1200px",
  height: "85vh",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  padding: "24px",
  borderRadius: "16px",
  border: "1px solid var(--color-border)",
  background: "var(--card-solid, #131B2E)",
  color: "var(--color-foreground, #E9F6EE)",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "18px",
  fontWeight: 700,
  color: "var(--color-foreground)",
};

const closeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  borderRadius: "var(--radius-control)",
  border: "1px solid var(--color-border)",
  background: "transparent",
  color: "var(--color-muted-foreground)",
  cursor: "pointer",
};

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function trapFocus(e: KeyboardEvent, panel: HTMLElement | null) {
  if (!panel) return;
  const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (!panel.contains(active)) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * Centered glass modal. Esc closes, backdrop click closes, focus is trapped,
 * and body scroll locks while open. aria-modal="true".
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab") {
        trapFocus(e, panelRef.current);
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
      lastFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        backgroundColor: "rgba(5, 10, 20, 0.65)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "60vw",
          maxWidth: "1000px",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "24px",
          borderRadius: "16px",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          backgroundColor: "#0B1220",
          color: "#E9F6EE",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.95)",
          overflow: "hidden",
        }}
      >
        <div style={headerStyle}>
          {title ? <div style={titleStyle}>{title}</div> : null}
          <button type="button" onClick={onClose} aria-label={copy.close} style={closeStyle}>
            <X size={16} weight="regular" aria-hidden="true" />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</div>
      </div>
    </div>
  );
}
