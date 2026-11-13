import type { CSSProperties } from "react";

export const shellStyle: CSSProperties = {
  borderRadius: "12px",
  border: "1px solid var(--color-border)",
  background: "var(--color-background)",
  color: "var(--color-foreground)",
  padding: "24px",
  height: "100%",
  minHeight: 0,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
};

export const centerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
};

export const scrollStyle: CSSProperties = {
  overflowY: "auto",
  flex: 1,
  paddingRight: "8px",
};

export const mdStyle: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "15px",
  lineHeight: "1.75",
  color: "var(--color-foreground)",
  overflowWrap: "break-word",
};

export const inlineCodeStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.9em",
  padding: "2px 4px",
  borderRadius: "var(--radius-chip)",
  background: "var(--color-muted)",
  color: "var(--color-accent-foreground)",
};

export const blockCodeTextStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
};

export const linkStyle: CSSProperties = {
  color: "var(--color-primary)",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

export const tableWrapStyle: CSSProperties = { overflowX: "auto", margin: "12px 0" };
export const tableStyle: CSSProperties = { borderCollapse: "collapse", width: "100%", fontSize: "13px" };
export const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: "2px solid var(--color-border)",
  fontWeight: 600,
};
export const tdStyle: CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--color-border)",
};
export const quoteStyle: CSSProperties = {
  margin: "12px 0",
  padding: "4px 12px",
  borderLeft: "3px solid var(--color-primary)",
  borderRadius: "0 var(--radius-control) var(--radius-control) 0",
  background: "var(--color-muted)",
  color: "var(--color-muted-foreground)",
};
export const hrStyle: CSSProperties = { border: "none", borderTop: "1px solid var(--color-border)", margin: "16px 0" };
