"use client";

export type CommandId = "convert";

export interface CommandNavProps {
  active?: CommandId;
  onChange?: (id: CommandId) => void;
  disabled?: boolean;
}

/**
 * Streamlined single-workspace navigation bar for tokens.md.
 */
export function CommandNav(_props: CommandNavProps) {
  return null;
}
