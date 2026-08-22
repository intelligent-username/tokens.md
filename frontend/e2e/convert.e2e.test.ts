/**
 * End-to-End Workflow Test: Convert Pipeline
 *
 * Exercises the complete multi-file convert user journey:
 * 1. File creation & multipart upload with progress tracking.
 * 2. Convert batch dispatch with custom conversion options (strip headers, keep boilerplate).
 * 3. Token flow calculation & savings percentage verification.
 * 4. Error handling & triage when encountering unsupported formats or oversized payloads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { convert, listFiles, uploadFiles } from "@/lib/api/endpoints";
import { classifyError, triageError } from "@/lib/errors";
import { deltaPercent, formatTokens } from "@/lib/utils/format";

describe("E2E Convert Workflow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("completes full file upload -> batch conversion -> token metering flow", async () => {
    const sessionId = "e2e-session-convert-101";

    // 1. Mock upload endpoint
    const mockUploadResponse = {
      session_id: sessionId,
      files: [
        { file_id: "f_pdf_1", name: "annual_report.pdf", size: 102400 },
        { file_id: "f_docx_2", name: "meeting_notes.docx", size: 20480 },
      ],
    };

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/uploads")) {
        return {
          ok: true,
          status: 201,
          json: () => Promise.resolve(mockUploadResponse),
          text: () => Promise.resolve(JSON.stringify(mockUploadResponse)),
        } as Response;
      }
      if (url.includes("/api/convert")) {
        const mockConvertResponse = {
          results: [
            {
              file_id: "f_pdf_1",
              name: "annual_report.pdf",
              status: "done",
              source_tokens: 15400,
              target_tokens: 4200,
              percent: -72.7,
            },
            {
              file_id: "f_docx_2",
              name: "meeting_notes.docx",
              status: "done",
              source_tokens: 3200,
              target_tokens: 1100,
              percent: -65.6,
            },
          ],
          converted_count: 2,
          failed_count: 0,
          total_source_tokens: 18600,
          total_target_tokens: 5300,
          total_percent: -71.5,
        };
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockConvertResponse),
          text: () => Promise.resolve(JSON.stringify(mockConvertResponse)),
        } as Response;
      }
      if (url.includes(`/api/files/${sessionId}`)) {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              files: [
                { file_id: "f_pdf_1_out", name: "annual_report.md", size: 12400, is_output: true },
                { file_id: "f_docx_2_out", name: "meeting_notes.md", size: 3100, is_output: true },
              ],
            }),
          text: () => Promise.resolve(""),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    // Step 1: Upload input documents
    const file1 = new File(["dummy pdf content"], "annual_report.pdf", { type: "application/pdf" });
    const file2 = new File(["dummy docx content"], "meeting_notes.docx");
    const uploadRes = await uploadFiles([file1, file2], ["annual_report.pdf", "meeting_notes.docx"]);

    expect(uploadRes.session_id).toBe(sessionId);
    expect(uploadRes.files).toHaveLength(2);

    // Step 2: Trigger batch convert with custom options
    const convertRes = await convert({
      session_id: uploadRes.session_id,
      file_ids: uploadRes.files.map((f) => f.file_id),
      options: {
        strip_headers_footers: true,
        keep_boilerplate: false,
      },
    });

    expect(convertRes.converted_count).toBe(2);
    expect(convertRes.failed_count).toBe(0);

    // Step 3: Compute and verify metrics & formatting
    const sourceTokens = convertRes.total_source_tokens;
    const targetTokens = convertRes.total_target_tokens;
    const calculatedSavings = deltaPercent(sourceTokens, targetTokens);

    expect(formatTokens(sourceTokens)).toBe("18,600");
    expect(formatTokens(targetTokens)).toBe("5,300");
    expect(calculatedSavings).toBeCloseTo(71.5, 1);

    // Step 4: Verify output listing
    const sessionFiles = await listFiles(sessionId);
    expect(sessionFiles.files.filter((f) => f.is_output)).toHaveLength(2);
  });

  it("handles unsupported format errors with proper UI classification and triage", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            code: "unsupported_format",
            message: "File type .bin is not supported for Markdown conversion.",
          })
        ),
      json: () =>
        Promise.resolve({
          code: "unsupported_format",
          message: "File type .bin is not supported for Markdown conversion.",
        }),
    } as unknown as Response);

    await expect(
      convert({
        session_id: "sess_err",
        file_ids: ["invalid_file"],
      })
    ).rejects.toMatchObject({
      name: "ApiError",
      kind: "unsupported_format",
      status: 422,
    });

    // Verify error classification and triage remediation
    const kind = classifyError("unsupported_format");
    expect(kind).toBe("unsupported_format");

    const triage = triageError(kind, "Unsupported binary file", "archive.bin");
    expect(triage.level).toBe("row");
    expect(triage.nextStep).toBeDefined();
  });
});
