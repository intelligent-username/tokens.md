import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import copy from "@/lib/copy";
import { ConvertWorkspace } from "@/components/workspaces/ConvertWorkspace";
import { FileMatrixRow } from "@/components/convert/FileMatrixRow";
import { useConvertRunner, type UseConvertRunnerOptions } from "@/components/convert/useConvertRunner";

vi.mock("@/components/convert/useConvertRunner", () => ({ useConvertRunner: vi.fn() }));
vi.mock("@/components/convert/InputFileMatrix", () => ({ InputFileMatrix: () => null }));
vi.mock("@/components/convert/FileFlowStream", () => ({ FileFlowStream: () => null }));
vi.mock("@/components/convert/ResultClipButton", () => ({
  ResultClipButton: () => null,
  TotalCompressionPill: () => null,
}));
vi.mock("@/components/ui/MarkdownPreviewButton", () => ({ MarkdownPreviewButton: () => null }));

let running: boolean;
const run = vi.fn();

beforeEach(() => {
  running = false;
  vi.mocked(useConvertRunner).mockImplementation((options: UseConvertRunnerOptions) => ({
    sessionId: null,
    convertedMap: {},
    uploadMetaMap: {},
    mergeResult: null,
    inputResult: null,
    error: null,
    setError: vi.fn(),
    running,
    getFileKey: (file: File) => file.name,
    unconvertedFiles: options.files,
    run,
    onFiles: (files: File[]) => options.setFiles(files),
    onRemoveFile: vi.fn(),
    onClearAll: vi.fn(),
    handleCopyAll: vi.fn(),
    setInputResult: vi.fn(),
  }));
});

afterEach(() => cleanup());

describe("conversion workbench", () => {
  it("disables the spinner-free upload action during conversion and retains its status", async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(React.createElement(ConvertWorkspace));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["content"], "source.txt", { type: "text/plain" }));
    const button = screen.getByRole("button", { name: copy.convertIdle }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    running = true;
    rerender(React.createElement(ConvertWorkspace));
    expect(button.disabled).toBe(true);
    expect(button.querySelector("svg")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain(copy.convertingBusy);
    await user.click(button);
    expect(run).not.toHaveBeenCalled();
  });

  it("disables the spinner-free URL action while running, not merely when the URL is empty", async () => {
    const user = userEvent.setup();
    const { rerender } = render(React.createElement(ConvertWorkspace));
    await user.click(screen.getByRole("button", { name: "Input" }));
    const button = screen.getByRole("button", { name: "Fetch & Convert" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await user.type(screen.getByRole("textbox", { name: "Web Page or Git Repository URL" }), "https://example.com/article");
    expect(button.disabled).toBe(false);
    running = true;
    rerender(React.createElement(ConvertWorkspace));
    expect(button.disabled).toBe(true);
    expect(button.querySelector("svg")).toBeNull();
    await user.click(button);
    expect(run).not.toHaveBeenCalled();
  });

  it("retains long input and output names and names the download for the output", () => {
    const inputName = `${"source-".repeat(20)}document.txt`;
    const outputName = `${"converted-".repeat(20)}document.md`;
    const file = new File(["content"], inputName);
    render(React.createElement(FileMatrixRow, {
      file,
      fileKey: inputName,
      resultItem: {
        file_id: "source-id", name: inputName, output_name: outputName,
        output_file_id: "output-id", source_tokens: 100, target_tokens: 75, percent: 25,
      },
      isConverting: false,
      isDone: true,
      mergeMode: false,
      sessionId: "session-id",
      onRemoveFile: vi.fn(),
    }));
    expect(screen.getByText(inputName)).toBeTruthy();
    expect(screen.getByText(outputName)).toBeTruthy();
    const download = screen.getByRole("link", { name: `Download ${outputName}` });
    expect(download.hasAttribute("download")).toBe(true);
    expect(download.getAttribute("href")).toContain("output-id");
    expect(screen.getByRole("button", { name: `Remove ${inputName}` })).toBeTruthy();
  });
});
