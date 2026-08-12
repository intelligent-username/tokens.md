"use client";

import { useState } from "react";
import { useHealth } from "@/lib/hooks/useHealth";
import { ConvertWorkspace } from "@/components/workspaces/ConvertWorkspace";
import { TopBar } from "./TopBar";
import type { CommandId } from "./CommandNav";

export function WorkbenchShell() {
  const [active, setActive] = useState<CommandId>("convert");
  const { status, retry } = useHealth();

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar active={active} onChange={setActive} health={status} onRetry={retry} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <ConvertWorkspace />
      </main>
    </div>
  );
}