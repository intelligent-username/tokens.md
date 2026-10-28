/**
 * End-to-End Workflow Test: URL Fetch, Repo Ingest & Sample Explorer
 *
 * Exercises:
 * 1. Direct URL extraction and Markdown generation.
 * 2. GitHub repository ingest into session workspace.
 * 3. Server sample discovery and sample file download.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSample, getConfig, getHealth, getSamples } from "@/lib/api/client";
import { fetchUrl, repo } from "@/lib/api/endpoints";

describe("E2E Fetch, Repo & Samples Pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches URL content, processes repo ingest, and downloads sample documents", async () => {
    const sessionId = "fetch-session-404";

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/health")) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ version: "0.0.17", encoding: "o200k_base", extensions: ["pdf", "docx", "md"] }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      if (url.includes("/api/config")) {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              extensions: ["pdf", "docx", "md"],
              limits: { max_upload_mb: 50, max_session_mb: 500, session_ttl_hours: 24 },
              feature_flags: { allow_local_paths: false },
            }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      if (url.includes("/api/fetch")) {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              url: "https://example.com/article",
              title: "Example Article",
              output_file_id: "f_url_1",
              output_name: "example_article.md",
              source_tokens: 2000,
              target_tokens: 450,
              percent: -77.5,
              text: "# Example Article\n\nContent extracted cleanly.",
            }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      if (url.includes("/api/repo")) {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              output_file_id: "f_repo_1_out",
              output_name: "cool-project.md",
              source_tokens: 50000,
              target_tokens: 12500,
              percent: -75,
              file_count: 14,
            }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      if (url.includes("/api/samples/guide.pdf")) {
        return {
          ok: true,
          status: 200,
          blob: () => Promise.resolve(new Blob(["PDF_BINARY_STREAM"], { type: "application/pdf" })),
          text: () => Promise.resolve(""),
        } as Response;
      }
      if (url.includes("/api/samples")) {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              samples: [
                { name: "guide.pdf", kind: "pdf" },
                { name: "data.csv", kind: "csv" },
              ],
            }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    // 1. Check system health & limits
    const health = await getHealth();
    expect(health.version).toBe("0.0.17");

    const config = await getConfig();
    expect(config.limits.max_upload_mb).toBe(50);

    // 2. Fetch URL content
    const urlRes = await fetchUrl({
      url: "https://example.com/article",
      session_id: sessionId,
    });
    expect(urlRes.target_tokens).toBe(450);
    expect(urlRes.text).toContain("# Example Article");

    // 3. Ingest Git repo
    const repoRes = await repo({
      session_id: sessionId,
      file_ids: ["f_repo_src"],
    });
    expect(repoRes.file_count).toBe(14);
    expect(repoRes.target_tokens).toBe(12500);

    // 4. Discover and fetch sample
    const sampleList = await getSamples();
    expect(sampleList.samples).toHaveLength(2);

    const sampleBlob = await fetchSample("guide.pdf");
    expect(sampleBlob).toBeInstanceOf(Blob);
    expect(sampleBlob.type).toBe("application/pdf");
  });
});
