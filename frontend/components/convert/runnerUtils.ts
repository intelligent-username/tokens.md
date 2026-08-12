import type { BudgetUnit } from "@/components/ui/BudgetInput";
import { CHARS_PER_TOKEN_ESTIMATE, TOKENS_PER_MB_ESTIMATE } from "./runnerConstants";

export function getFileKey(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

export function formatTargetUrl(inputUrl: string): string {
  const raw = inputUrl.trim();
  if (!raw) return "";
  return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
}

export function calculateBudgetTokens(enabled: boolean, value: number, unit: BudgetUnit): number | undefined {
  if (!enabled || value <= 0) return undefined;
  if (unit === "Tokens") return value;
  if (unit === "MB") return Math.round(value * TOKENS_PER_MB_ESTIMATE);
  return Math.round(value * CHARS_PER_TOKEN_ESTIMATE);
}
