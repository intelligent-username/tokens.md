import type { SVGProps } from "react";

interface TokenGlyphProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Six-pointed asterisk with one ray extended into a streaming tail.
 * Renders in currentColor; pair with text-emerald-500 and glyph-glow.
 */
export function TokenGlyph({ size = 24, ...rest }: TokenGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      {...rest}
    >
      <g stroke="currentColor" strokeLinecap="round">
        <path d="M16 16 V6.5" strokeWidth="2.4" />
        <path d="M16 16 L24.23 11.25" strokeWidth="2.4" />
        <path d="M16 16 L24.23 20.75" strokeWidth="2.4" />
        <path d="M16 16 V25.5" strokeWidth="2.4" />
        <path d="M16 16 L7.77 20.75" strokeWidth="2.4" />
        <path d="M16 16 L7.77 11.25" strokeWidth="2.4" />
        <path d="M24.23 11.25 L27.69 9.25" strokeWidth="2" />
        <path d="M27.69 9.25 L29.15 8.37" strokeWidth="1.4" opacity="0.65" />
        <path d="M29.15 8.37 L30.2 7.7" strokeWidth="0.9" opacity="0.4" />
      </g>
    </svg>
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