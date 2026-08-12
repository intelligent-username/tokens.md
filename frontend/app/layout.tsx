import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "tokens.md",
  description: "Shrink AI context. Convert, merge, and watch token budgets.",
  icons: {
    icon: "/icon.svg",
  },
};

// Applies the stored (or system) theme before first paint. Dark is the default.
const themeScript = `(function(){try{var s=window.localStorage.getItem("tmd-theme");var d=s==="light"?false:s==="dark"?true:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?false:true);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body
        className="font-sans antialiased"
        style={
          {
            "--font-display": 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            "--font-sans": 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            "--font-mono": 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          } as React.CSSProperties
        }
        suppressHydrationWarning
      >
        <div className="canvas-backdrop" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}