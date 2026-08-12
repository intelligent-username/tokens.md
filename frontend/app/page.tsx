"use client";

import { ThemeProvider } from "./theme";
import { Providers } from "./providers";
import { WorkbenchShell } from "@/components/layout/WorkbenchShell";

export default function Home() {
  return (
    <ThemeProvider>
      <Providers>
        <WorkbenchShell />
      </Providers>
    </ThemeProvider>
  );
}
