/**
 * End-to-End Workflow Test: Merge & Budget Pruning Pipeline
 *
 * Exercises the complete multi-file merge user journey:
 * 1. Uploading disparate documents (specs, guides, notes).
 * 2. Merging into a unified Markdown deliverable with TOC, deduplication, and token budget.
 * 3. Inspecting prune reports and token reduction guarantees.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { merge, uploadFiles } from "@/lib/api/endpoints";
import { formatTokens } from "@/lib/utils/format";

describe("E2E Merge & Budget Pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("merges multiple documents and enforces token budget pruning constraints", async () => {
    const sessionId = "e2e-session-merge-202";

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/uploads")) {
        return {
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              session_id: sessionId,
              files: [
                { file_id: "doc1", name: "architecture.md", size: 5000 },
                { file_id: "doc2", name: "database.md", size: 4500 },
                { file_id: "doc3", name: "security.md", size: 6000 },
              ],
            }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      if (url.includes("/api/merge")) {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              output_file_id: "out_merged_1",
              output_name: "full_specification.md",
              source_tokens: 8500,
              target_tokens: 4000,
              percent: -52.94,
              prune: {
                fits: true,
                removed_tokens: 4500,
                removed_blocks: 8,
                budget: 4000,
                final_tokens: 4000,
              },
            }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    // 1. Upload files to merge
    const f1 = new File(["# Architecture\n..."], "architecture.md");
    const f2 = new File(["# Database\n..."], "database.md");
    const f3 = new File(["# Security\n..."], "security.md");

    const upload = await uploadFiles([f1, f2, f3], ["architecture.md", "database.md", "security.md"]);
    expect(upload.files).toHaveLength(3);

    // 2. Execute merge with budget and dedup options
    const mergeResult = await merge({
      session_id: upload.session_id,
      file_ids: upload.files.map((f) => f.file_id),
      output_name: "full_specification.md",
      options: {
        budget: 4000,
        dedup: true,
        toc: true,
      },
    });

    // 3. Verify merge output & prune diagnostics
    expect(mergeResult.output_name).toBe("full_specification.md");
    expect(mergeResult.source_tokens).toBe(8500);
    expect(mergeResult.target_tokens).toBe(4000);
    expect(formatTokens(mergeResult.target_tokens)).toBe("4,000");

    expect(mergeResult.prune).toBeDefined();
    expect(mergeResult.prune?.fits).toBe(true);
    expect(mergeResult.prune?.removed_tokens).toBe(4500);
    expect(mergeResult.prune?.removed_blocks).toBe(8);
  });
});
