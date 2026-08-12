"use client";

import copy from "../../lib/copy";
import { formatTokens, nextCeiling } from "./format";

interface BudgetGaugeProps {
  /** Sum of source tokens (before pruning). */
  sourceTokens: number;
  /** The hard ceiling the user set. */
  ceiling: number;
  /** null = not run yet; true = fits; false = still over budget. */
  fits: boolean | null;
  /** Final token count after pruning (for the "Raise the ceiling to N+" hint). */
  finalTokens?: number;
  /** Called with a suggested ceiling when the user clicks the raise hint. */
  onSuggestCeiling?: (ceiling: number) => void;
}

/**
 * Ceiling gauge for the Budget workspace (ux-flows §2.5). Shows source vs
 * ceiling; turns red when the pruned result still exceeds the ceiling and
 * offers "Raise the ceiling to N+".
 */
export function BudgetGauge({ sourceTokens, ceiling, fits, finalTokens, onSuggestCeiling }: BudgetGaugeProps) {
  const over = fits === false;
  const suggested = finalTokens !== undefined && over ? nextCeiling(finalTokens) : null;
  const ratio = ceiling > 0 ? Math.min(1, ceiling / sourceTokens) : 0;
  const fillPercent = sourceTokens > 0 ? ratio * 100 : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "16px",
        borderRadius: "16px",
        border: `1px solid ${over ? "rgba(220,38,38,0.4)" : "var(--color-border, rgba(255,255,255,0.12))"}`,
        background: over ? "rgba(220,38,38,0.10)" : "var(--color-card, rgba(255,255,255,0.06))",
        fontSize: "13px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span style={{ opacity: 0.8 }}>{formatTokens(sourceTokens)} source</span>
        <span style={{ opacity: 0.8 }}>vs {formatTokens(ceiling)} ceiling</span>
      </div>

      <div
        role="img"
        aria-label={`${formatTokens(sourceTokens)} source tokens against a ceiling of ${formatTokens(ceiling)}`}
        style={{
          height: "10px",
          borderRadius: "999px",
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${fillPercent}%`,
            borderRadius: "999px",
            background: over ? "#DC2626" : "var(--color-primary, #16DE81)",
            transition: "width 300ms ease-out, background 300ms ease-out",
          }}
        />
      </div>

      {sourceTokens > 0 && !over && fits !== true ? <div style={{ opacity: 0.75 }}>{copy.willPrune}</div> : null}

      {fits === true ? <div style={{ color: "var(--color-emerald-300, #90EEC2)" }}>{copy.fitsBudget}</div> : null}

      {over ? (
        <div style={{ color: "#FF8A8A", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div>{copy.budgetOver}</div>
          {suggested !== null ? (
            <button
              type="button"
              onClick={() => onSuggestCeiling?.(suggested)}
              style={{
                alignSelf: "flex-start",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(220,38,38,0.4)",
                background: "transparent",
                color: "#FF8A8A",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {copy.raiseCeilingTo(suggested)}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
