"use client";

import { useState } from "react";
import copy from "@/lib/copy";
import { useHealth } from "@/lib/hooks/useHealth";
import { Banner } from "@/components/ux/Banner";
import { ConvertWorkspace } from "@/components/workspaces/ConvertWorkspace";
import { TopBar } from "./TopBar";
import type { CommandId } from "./CommandNav";

/**
 * Single-route workbench shell: sticky TopBar, offline Banner, and the single-page workspace.
 */
export function WorkbenchShell() {
  const [active, setActive] = useState<CommandId>("convert");
  const { status, retry } = useHealth();

  const offline = status === "offline";
  const degraded = status === "degraded";

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar active={active} onChange={setActive} health={status} />

      {offline || degraded ? (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
          <Banner
            message={offline ? copy.backendOffline : copy.connectionLost}
            retry={retry}
            variant={offline ? "offline" : "warning"}
          />
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <ConvertWorkspace />
      </main>
    </div>
  );
}