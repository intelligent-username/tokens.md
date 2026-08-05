import type { SVGProps } from "react";

interface TokenGlyphProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Six-pointed asterisk with one ray extended into a streaming tail.
 * Renders in currentColor; pair with text-emerald-500 and glyph-glow.
 */
export function TokenGlyph({ size = 28, className }: TokenGlyphProps) {
  return (
    <img
      src="/logo.svg"
      alt="tokens.md logo"
      style={{ height: `${size}px` }}
      className={`w-auto shrink-0 object-contain glyph-glow ${className || ""}`}
    />
  );
}

/** "tokens.md" wordmark: mint-white "tokens" + emerald ".md". */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-baseline font-display text-xl font-bold leading-none tracking-tight${
        className ? ` ${className}` : ""
      }`}
    >
      <span className="text-foreground">tokens</span>
      <span className="text-emerald-500">.md</span>
    </span>
  );
}