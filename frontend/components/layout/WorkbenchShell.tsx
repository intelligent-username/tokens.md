"use client";

import { useState, type ComponentType } from "react";
import copy from "@/lib/copy";
import { useHealth } from "@/lib/hooks/useHealth";
import { Banner } from "@/components/ux/Banner";
import { ConvertWorkspace } from "@/components/workspaces/ConvertWorkspace";
import { MergeWorkspace } from "@/components/workspaces/MergeWorkspace";
import { ClipWorkspace } from "@/components/workspaces/ClipWorkspace";
import { FetchWorkspace } from "@/components/workspaces/FetchWorkspace";
import { RepoWorkspace } from "@/components/workspaces/RepoWorkspace";
import { WatchWorkspace } from "@/components/workspaces/WatchWorkspace";
import { DeltaWorkspace } from "@/components/workspaces/DeltaWorkspace";
import { BudgetWorkspace } from "@/components/workspaces/BudgetWorkspace";
import { TopBar } from "./TopBar";
import type { CommandId } from "./CommandNav";

const WORKSPACES: Record<CommandId, ComponentType> = {
  convert: ConvertWorkspace,
  merge: MergeWorkspace,
  clip: ClipWorkspace,
  fetch: FetchWorkspace,
  repo: RepoWorkspace,
  watch: WatchWorkspace,
  delta: DeltaWorkspace,
  budget: BudgetWorkspace,
};

/**
 * Single-route workbench shell: sticky TopBar (wordmark + nav + health +
 * theme), an offline Banner, and the active workspace. The workspace is
 * keyed by command so switching resets its results pane.
 */
export function WorkbenchShell() {
  const [active, setActive] = useState<CommandId>("convert");
  const { status, retry } = useHealth();

  const offline = status === "offline";
  const degraded = status === "degraded";
  const Workspace = WORKSPACES[active];

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar active={active} onChange={setActive} health={status} />

      {offline || degraded ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
          <Banner
            message={offline ? copy.backendOffline : copy.connectionLost}
            retry={retry}
            variant={offline ? "offline" : "warning"}
          />
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <Workspace key={active} />
      </main>
    </div>
  );
}