import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import copy from "@/lib/copy";
import { MarkdownPreviewButton } from "@/components/ui/MarkdownPreviewButton";
import { mdStyle, shellStyle } from "@/components/ui/markdown/styles";

afterEach(() => cleanup());

const output = { sessionId: "session-id", fileId: "output-id", name: "result.md" };

describe("Markdown preview", () => {
  it("loads Markdown in a dialog, traps focus, and restores focus on Escape", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (value: string) => void;
    const fetcher = vi.fn(() => new Promise<string>((resolve) => { resolveFetch = resolve; }));
    const originalOverflow = document.body.style.overflow;
    render(React.createElement(MarkdownPreviewButton, { output, fetcher }));
    const trigger = screen.getByRole("button", { name: copy.preview });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: output.name });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(output);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(within(dialog).getByRole("status").textContent).toContain(copy.sampleLoading);

    await act(async () => {
      resolveFetch("# Converted document\n\nUseful **Markdown**.\n\n| Name | Value |\n| --- | --- |\n| File | 42 |");
    });
    expect(within(dialog).getByRole("heading", { name: "Converted document" })).toBeTruthy();
    expect(within(dialog).getByText("Markdown").tagName).toBe("STRONG");
    expect(within(dialog).getByRole("table")).toBeTruthy();
    expect(within(dialog).queryByRole("status")).toBeNull();

    const close = within(dialog).getByRole("button", { name: copy.close });
    close.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it("shows the fetcher's error without displaying stale Markdown", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn()
      .mockResolvedValueOnce("# Earlier content")
      .mockRejectedValueOnce(new Error("Preview unavailable"));
    render(React.createElement(MarkdownPreviewButton, { output, fetcher }));
    const trigger = screen.getByRole("button", { name: copy.preview });
    await user.click(trigger);
    expect(await screen.findByRole("heading", { name: "Earlier content" })).toBeTruthy();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: copy.close }));
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: output.name });
    expect(await within(dialog).findByText("Preview unavailable")).toBeTruthy();
    expect(within(dialog).queryByRole("heading", { name: "Earlier content" })).toBeNull();
    expect(within(dialog).queryByRole("status")).toBeNull();
    expect(fetcher).toHaveBeenCalledWith(output);
    await user.click(within(dialog).getByRole("button", { name: copy.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("uses semantic tokens for preview state surfaces and Markdown text", () => {
    // jsdom cannot establish responsive layout or actual light/dark contrast.
    expect(shellStyle.background).toBe("var(--color-background)");
    expect(shellStyle.color).toBe("var(--color-foreground)");
    expect(shellStyle.border).toContain("var(--color-border)");
    expect(mdStyle.color).toBe("var(--color-foreground)");
  });
});
