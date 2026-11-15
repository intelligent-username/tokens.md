import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownStructureExplorer } from "@/components/convert/MarkdownStructureExplorer";
import type { PreviewableOutput } from "@/lib/hooks/useMarkdownPreview";
import { outputKey } from "@/lib/utils/markdownStructure";
import copy from "@/lib/copy";

const a = { sessionId: "session-a", fileId: "shared-id", name: "a.md" };
const b = { sessionId: "session-b", fileId: "shared-id", name: "b.md" };
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
let scrollIntoView: ReturnType<typeof vi.fn>;

function deferred() {
  let resolve!: (content: string) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("Markdown structure explorer", () => {
  it("maps full-document renderer offsets to exact passages and preserves Markdown semantics", async () => {
    const user = userEvent.setup();
    const source = [
      "# **Résumé 😀**", "",
      "Read [the reference][later] with *emphasis*.", "",
      "## Repeat", "", "### Repeat", "",
      "Setext *title*", "--------------", "",
      "> Quoted **passage**.", "",
      "- Tight first", "  - Tight nested", "",
      "---", "",
      "- Loose first", "", "- Loose second", "",
      "```js", '# code, not a heading', 'const text = "😀";', "```", "",
      "    indented_code()", "",
      "| Name | Value |", "| --- | --- |", "| a\\|b | **two** |", "",
      "Final readable paragraph Ω.", "",
      "[later]: https://example.com/reference \"Later definition\"",
    ].join("\r\n");
    const fetcher = vi.fn(async () => source);
    const { container } = render(React.createElement(MarkdownStructureExplorer, { outputs: [a], fetcher }));
    const outline = await screen.findByRole("region", { name: "Passage outline" });
    const targets = Array.from(container.querySelectorAll<HTMLElement>("[data-passage-kind]"));
    const expected = [
      ["heading", "# **Résumé 😀**"],
      ["paragraph", "Read [the reference][later] with *emphasis*."],
      ["heading", "## Repeat"],
      ["heading", "### Repeat"],
      ["heading", "Setext *title*\r\n--------------"],
      ["paragraph", "Quoted **passage**."],
      ["paragraph", "Loose first"],
      ["paragraph", "Loose second"],
      ["code", '```js\r\n# code, not a heading\r\nconst text = "😀";\r\n```'],
      ["code", "    indented_code()"],
      ["table", "| Name | Value |\r\n| --- | --- |\r\n| a\\|b | **two** |"],
      ["paragraph", "Final readable paragraph Ω."],
    ];
    expect(targets).toHaveLength(expected.length);
    expect(new Set(targets.map((target) => target.id)).size).toBe(expected.length);
    expected.forEach(([kind, snippet], index) => {
      const target = targets[index];
      const start = source.indexOf(snippet);
      const end = start + snippet.length;
      expect(start).toBeGreaterThanOrEqual(0);
      expect(target.dataset.passageKind).toBe(kind);
      expect(Number(target.dataset.startOffset)).toBe(start);
      expect(Number(target.dataset.endOffset)).toBe(end);
      expect(Number(target.dataset.startLine)).toBe(source.slice(0, start).split("\r\n").length);
      expect(Number(target.dataset.endLine)).toBe(source.slice(0, end).split("\r\n").length);
      expect(target.id.endsWith(`-${kind}-${start}`)).toBe(true);
    });
    expect(within(outline).getAllByRole("listitem")).toHaveLength(expected.length);
    expect(screen.getByRole("button", { name: "Structure", pressed: true })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Résumé 😀" })).toBeNull();

    const duplicate = within(outline).getByRole("button", { name: /Heading 3 Line 7 Repeat/ });
    duplicate.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(targets[3]);
    expect(targets[3].dataset.selected).toBe("true");
    expect(targets[2].hasAttribute("data-selected")).toBe(false);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "auto" });
    expect(screen.getByRole("heading", { name: "Résumé 😀" }).querySelector("strong")?.textContent).toBe("Résumé 😀");
    expect(screen.getByRole("heading", { name: "Setext title", level: 2 }).querySelector("em")).toBeTruthy();
    expect(screen.getByRole("link", { name: "the reference" }).getAttribute("href")).toBe("https://example.com/reference");
    expect(screen.getByText("Tight nested").closest("li")).toBeTruthy();
    expect(screen.getByText("Tight nested").closest("p")).toBeNull();
    expect(container.querySelector("blockquote strong")?.textContent).toBe("passage");
    expect(within(screen.getByRole("table")).getByRole("cell", { name: "a|b" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: copy.copyMarkdown })).toHaveLength(2);
    expect(container.querySelectorAll('pre code')).toHaveLength(2);
    expect(within(targets[0].parentElement!).getByText("Final readable paragraph Ω.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "code, not a heading" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Outline" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Structure" }));
    expect(targets[3].hasAttribute("data-selected")).toBe(false);
    await user.click(within(screen.getByRole("group", { name: "Passage map" })).getByRole("button", { name: /Read table,/ }));
    expect(document.activeElement).toBe(targets[10]);
    expect(targets[10].dataset.selected).toBe("true");
    expect(Array.from(container.querySelectorAll("[data-passage-kind]"))).toEqual(targets);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("retains full reading content while bounding and paging the outline and diagram", async () => {
    const user = userEvent.setup();
    const source = Array.from({ length: 101 }, (_, index) => `Paragraph ${index + 1}.`).join("\n\n");
    const fetcher = vi.fn(async () => source);
    const { container } = render(React.createElement(MarkdownStructureExplorer, { outputs: [a], fetcher }));
    const outline = await screen.findByRole("region", { name: "Passage outline" });
    const readingNodes = Array.from(container.querySelectorAll("[data-passage-kind]"));
    expect(readingNodes).toHaveLength(101);
    expect(within(outline).getAllByRole("listitem")).toHaveLength(48);
    expect(within(screen.getByRole("group", { name: "Passage map" })).getAllByRole("button")).toHaveLength(12);
    expect(screen.getByText("Showing passages 1–48 of 101")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
    const next = screen.getByRole("button", { name: "Next" });
    next.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(next);
    expect(screen.getByText("Showing passages 49–96 of 101")).toBeTruthy();
    await user.click(next);
    expect(screen.getByText("Showing passages 97–101 of 101")).toBeTruthy();
    expect(within(outline).getAllByRole("listitem")).toHaveLength(5);
    expect((next as HTMLButtonElement).disabled).toBe(true);
    await user.click(within(outline).getByRole("button", { name: /Paragraph 101\.$/ }));
    expect(document.activeElement).toBe(readingNodes[100]);
    const reading = within(readingNodes[0].parentElement!);
    expect(reading.getByText("Paragraph 1.")).toBeTruthy();
    expect(reading.getByText("Paragraph 101.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Outline" }));
    expect(screen.getByText("Showing passages 97–101 of 101")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Showing passages 49–96 of 101")).toBeTruthy();
    expect(Array.from(container.querySelectorAll("[data-passage-kind]"))).toEqual(readingNodes);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not execute raw HTML or expose javascript URLs", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async () => [
      "# Safe reading", "",
      '<script>window.manuscriptInjected = true</script>', "",
      '<img src=x onerror="window.manuscriptInjected = true">', "",
      '[unsafe](javascript:alert%281%29)', "",
      "[safe](https://example.com/safe)",
    ].join("\n"));
    const { container } = render(React.createElement(MarkdownStructureExplorer, { outputs: [a], fetcher }));
    await user.click(await screen.findByRole("button", { name: "Reading" }));
    expect(container.querySelector("script, img, [onerror], [onclick]")).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    const unsafe = screen.getByText("unsafe").closest("a");
    expect(unsafe).toBeTruthy();
    expect(unsafe?.getAttribute("href") || "").toBe("");
    const safe = screen.getByRole("link", { name: "safe" });
    expect(safe.getAttribute("href")).toBe("https://example.com/safe");
    expect(safe.getAttribute("rel")).toContain("noreferrer");
  });

  it("preserves image alt text without loading remote, local or relative image URLs", async () => {
    const user = userEvent.setup();
    const network = vi.fn().mockRejectedValue(new Error("Unexpected automatic image request"));
    vi.stubGlobal("fetch", network);
    const fetcher = vi.fn(async () => [
      "# Image references", "",
      "![Remote preview](https://example.com/tracker.png)", "",
      "![Local preview](/api/sessions/private/download/image.png)", "",
      "![Relative preview](../private/image.png)",
    ].join("\n"));
    const { container } = render(React.createElement(MarkdownStructureExplorer, { outputs: [a], fetcher }));
    await user.click(await screen.findByRole("button", { name: "Reading" }));
    const reading = within(screen.getByRole("heading", { name: "Image references" }).parentElement!);
    for (const alt of ["Remote preview", "Local preview", "Relative preview"]) {
      expect(reading.getByText(alt, { exact: false })).toBeTruthy();
    }
    expect(container.querySelector("img, picture, source, iframe, object, embed")).toBeNull();
    expect(container.querySelector("[src], [srcset], [poster], link[rel='preload'], link[rel='prefetch']")).toBeNull();
    expect(network).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledWith(a);
  });

  it("offers full Reading when a document has no positioned outline blocks", async () => {
    const user = userEvent.setup();
    render(React.createElement(MarkdownStructureExplorer, { outputs: [a], fetcher: async () => "- Just a tight list\n- Still readable" }));
    expect(await screen.findByText(/No heading, paragraph, table or code passages to outline/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reading" }));
    expect(screen.getByRole("list").textContent).toContain("Still readable");
  });

  it("distinguishes loading, failure, retry and empty successful output", async () => {
    const user = userEvent.setup();
    const first = deferred();
    const retry = deferred();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
    render(React.createElement(MarkdownStructureExplorer, { outputs: [a], fetcher }));
    expect(screen.getByRole("region", { name: "Loading Markdown output" }).getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("This output contains no Markdown")).toBeNull();
    await act(async () => { first.reject(new Error("Output unavailable")); });
    expect(screen.getByRole("region", { name: "Markdown loading error" }).textContent).toContain("Output unavailable");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.queryByText("Output unavailable")).toBeNull();
    expect(screen.getByRole("region", { name: "Loading Markdown output" })).toBeTruthy();
    await act(async () => { retry.resolve(""); });
    expect(screen.getByText("This output contains no Markdown")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Loading Markdown output" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(fetcher.mock.calls).toEqual([[a], [a]]);
  });

  it.each(["success", "rejection"] as const)("ignores late A %s after switching to B in another session", async (outcome) => {
    const user = userEvent.setup();
    const pendingA = deferred();
    const pendingB = deferred();
    const fetcher = vi.fn((output: PreviewableOutput) => output.sessionId === a.sessionId ? pendingA.promise : pendingB.promise);
    const { container } = render(React.createElement(MarkdownStructureExplorer, { outputs: [a, b], fetcher }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Output" }), outputKey(b));
    await act(async () => { pendingB.resolve("# Current B"); });
    await user.click(screen.getByRole("button", { name: "Reading" }));
    await act(async () => {
      if (outcome === "success") pendingA.resolve("# Stale A");
      else pendingA.reject(new Error("Stale A error"));
    });
    expect(screen.getByRole("heading", { name: "Current B" })).toBeTruthy();
    expect(container.textContent).not.toContain("Stale A");
    expect((screen.getByRole("combobox", { name: "Output" }) as HTMLSelectElement).value).toBe(outputKey(b));
    expect(screen.queryByRole("region", { name: "Markdown loading error" })).toBeNull();
    expect(fetcher.mock.calls).toEqual([[a], [b]]);
  });

  it("isolates A → B → A generations, including stale success and rejection during loading", async () => {
    const user = userEvent.setup();
    const firstA = deferred();
    const pendingB = deferred();
    const secondA = deferred();
    const fetcher = vi.fn()
      .mockReturnValueOnce(firstA.promise)
      .mockReturnValueOnce(pendingB.promise)
      .mockReturnValueOnce(secondA.promise);
    const { container } = render(React.createElement(MarkdownStructureExplorer, { outputs: [a, b], fetcher }));
    const selector = screen.getByRole("combobox", { name: "Output" });
    await user.selectOptions(selector, outputKey(b));
    await user.selectOptions(selector, outputKey(a));
    await act(async () => {
      firstA.resolve("# Obsolete first A");
      pendingB.reject(new Error("Obsolete B error"));
    });
    expect(screen.getByRole("region", { name: "Loading Markdown output" })).toBeTruthy();
    expect(container.textContent).not.toContain("Obsolete");
    await act(async () => { secondA.resolve("# Fresh second A"); });
    await user.click(screen.getByRole("button", { name: "Reading" }));
    expect(screen.getByRole("heading", { name: "Fresh second A" })).toBeTruthy();
    expect(container.textContent).not.toContain("Obsolete");
    expect(fetcher.mock.calls).toEqual([[a], [b], [a]]);
  });

  it("retains selection across reorder/rename, resets views on removal and ignores removed requests", async () => {
    const user = userEvent.setup();
    const removedA = deferred();
    const fetcher = vi.fn()
      .mockResolvedValueOnce("# First A")
      .mockResolvedValueOnce("# Selected B")
      .mockReturnValueOnce(removedA.promise);
    const { rerender, container } = render(React.createElement(MarkdownStructureExplorer, { outputs: [a, b], fetcher }));
    await screen.findByRole("region", { name: "Passage outline" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Output" }), outputKey(b));
    await user.click(await screen.findByRole("button", { name: "Reading" }));
    const renamedB = { ...b, name: "renamed.md" };
    rerender(React.createElement(MarkdownStructureExplorer, { outputs: [renamedB, a], fetcher }));
    expect(screen.getByRole("heading", { name: "Selected B" })).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(2);
    rerender(React.createElement(MarkdownStructureExplorer, { outputs: [a], fetcher }));
    expect((screen.getByRole("combobox", { name: "Output" }) as HTMLSelectElement).value).toBe(outputKey(a));
    expect(screen.queryByRole("heading", { name: "Selected B" })).toBeNull();
    rerender(React.createElement(MarkdownStructureExplorer, { outputs: [], fetcher }));
    await act(async () => { removedA.resolve("# Removed A"); });
    expect(screen.getByText(/No Markdown outputs yet/)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(container.textContent).not.toContain("Removed A");
  });

  it("keeps the fallback selection when a removed output returns and resets its outline page", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async (output: PreviewableOutput) => output === a
      ? Array.from({ length: 49 }, (_, index) => `A paragraph ${index}`).join("\n\n")
      : "# B document");
    const { rerender } = render(React.createElement(MarkdownStructureExplorer, { outputs: [a, b], fetcher }));
    await user.click(await screen.findByRole("button", { name: "Next" }));
    expect(screen.getByText("Showing passages 49–49 of 49")).toBeTruthy();
    rerender(React.createElement(MarkdownStructureExplorer, { outputs: [b], fetcher }));
    expect(await screen.findByText("Showing passages 1–1 of 1")).toBeTruthy();
    rerender(React.createElement(MarkdownStructureExplorer, { outputs: [a, b], fetcher }));
    expect((screen.getByRole("combobox", { name: "Output" }) as HTMLSelectElement).value).toBe(outputKey(b));
    await user.selectOptions(screen.getByRole("combobox", { name: "Output" }), outputKey(a));
    expect(await screen.findByText("Showing passages 1–48 of 49")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Structure", pressed: true })).toBeTruthy();
  });

  it.each(["success", "rejection"] as const)("invalidates a pending %s on unmount", async (outcome) => {
    const pending = deferred();
    const fetcher = vi.fn(() => pending.promise);
    const { unmount, container } = render(React.createElement(MarkdownStructureExplorer, { outputs: [a], fetcher }));
    unmount();
    await act(async () => {
      if (outcome === "success") pending.resolve("# Too late");
      else pending.reject(new Error("Too late"));
    });
    expect(container.childElementCount).toBe(0);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
