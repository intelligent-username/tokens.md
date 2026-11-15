import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectStructurePage,
  MAX_PASSAGE_LABEL,
  outputKey,
  readPassage,
  readPassageLabel,
  STRUCTURE_PAGE_SIZE,
} from "@/lib/utils/markdownStructure";

function passage(index: number, tag = "p", kind = "paragraph"): HTMLElement {
  const element = document.createElement(tag);
  element.id = `passage-${index}`;
  element.dataset.passageKind = kind;
  element.dataset.startOffset = String(index * 10);
  element.dataset.endOffset = String(index * 10 + 8);
  element.dataset.startLine = String(index + 1);
  element.dataset.endLine = String(index + 1);
  element.textContent = `Text ${index}`;
  return element;
}

afterEach(() => vi.restoreAllMocks());

describe("rendered Markdown structure", () => {
  it("retains DOM order, exact positions and heading levels through nested containers", () => {
    const root = document.createElement("div");
    const heading = passage(0, "h2", "heading");
    const quote = document.createElement("blockquote");
    const paragraph = passage(1);
    paragraph.dataset.endLine = "3";
    quote.append(paragraph);
    root.append(heading, quote, passage(3, "div", "table"), passage(4, "div", "code"));

    const page = collectStructurePage(root, 0);
    expect(page.total).toBe(4);
    expect(page.passages.map((item) => item.id)).toEqual(["passage-0", "passage-1", "passage-3", "passage-4"]);
    expect(readPassage(heading)).toEqual({
      id: "passage-0", kind: "heading", label: "Text 0",
      startOffset: 0, endOffset: 8, startLine: 1, endLine: 1, headingLevel: 2,
    });
    expect(readPassage(paragraph)).toEqual({
      id: "passage-1", kind: "paragraph", label: "Text 1",
      startOffset: 10, endOffset: 18, startLine: 2, endLine: 3,
    });
  });

  it.each([
    ["id", ""],
    ["data-passage-kind", "list"],
    ["data-start-offset", null],
    ["data-start-offset", "-1"],
    ["data-start-offset", " 0"],
    ["data-start-offset", "1e2"],
    ["data-start-offset", "0x10"],
    ["data-start-offset", "0.5"],
    ["data-end-offset", "9007199254740992"],
    ["data-end-offset", "9"],
    ["data-start-line", "0"],
    ["data-end-line", "1"],
  ])("ignores malformed annotation %s=%s", (attribute, value) => {
    const root = document.createElement("div");
    const invalid = passage(1);
    if (value === null) invalid.removeAttribute(attribute);
    else invalid.setAttribute(attribute, value);
    root.append(invalid, document.createElement("p"), passage(2));
    expect(readPassage(invalid)).toBeNull();
    expect(collectStructurePage(root, 0).passages.map((item) => item.id)).toEqual(["passage-2"]);
  });

  it("reads only the bounded text prefix and excludes code-copy controls", () => {
    const paragraph = passage(0);
    paragraph.replaceChildren(document.createTextNode("a".repeat(MAX_PASSAGE_LABEL)));
    const unread = document.createTextNode("private suffix");
    const suffixRead = vi.spyOn(unread, "nodeValue", "get");
    paragraph.append(unread);
    const fullTextRead = vi.spyOn(paragraph, "textContent", "get");
    expect(readPassageLabel(paragraph)).toBe("a".repeat(MAX_PASSAGE_LABEL));
    expect(suffixRead).not.toHaveBeenCalled();
    expect(fullTextRead).not.toHaveBeenCalled();

    const block = passage(1, "div", "code");
    const button = document.createElement("button");
    button.textContent = "Copy Markdown";
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = "# not a heading\nconst value = 1;";
    pre.append(code);
    block.replaceChildren(button, pre);
    expect(readPassageLabel(block)).toBe("# not a heading\nconst value = 1;");
  });

  it.each([
    ["heading", "Heading"], ["paragraph", "Paragraph"], ["table", "Table"], ["code", "Code"],
  ])("gives empty %s blocks a meaningful fallback", (kind, name) => {
    const element = passage(6, "div", kind);
    element.textContent = " \n ";
    expect(readPassageLabel(element)).toBe(`${name} at line 7`);
    element.removeAttribute("data-start-line");
    expect(readPassageLabel(element)).toBe(name);
  });

  it("bounds retained records and label reads, and clamps page boundaries", () => {
    const root = document.createElement("div");
    const elements = Array.from({ length: 101 }, (_, index) => passage(index));
    root.append(...elements);
    const offPageText = elements[48].firstChild!;
    const offPageRead = vi.spyOn(offPageText, "nodeValue", "get");
    const first = collectStructurePage(root, 0);
    expect(first.total).toBe(101);
    expect(first.passages).toHaveLength(STRUCTURE_PAGE_SIZE);
    expect(first.passages[47].id).toBe("passage-47");
    expect(offPageRead).not.toHaveBeenCalled();
    const second = collectStructurePage(root, 1);
    expect(second.passages).toHaveLength(48);
    expect(second.passages[0].id).toBe("passage-48");
    expect(second.passages[47].id).toBe("passage-95");
    const last = collectStructurePage(root, 999);
    expect(last.page).toBe(2);
    expect(last.passages.map((item) => item.id)).toEqual(
      ["passage-96", "passage-97", "passage-98", "passage-99", "passage-100"],
    );
    for (const page of [-1, NaN, Infinity, 0.5]) {
      expect(collectStructurePage(root, page).page).toBe(0);
    }
    expect(collectStructurePage(document.createElement("div"), 9)).toEqual({ passages: [], total: 0, page: 0 });
  });

  it("uses session/file identity, independent of names and delimiter collisions", () => {
    const output = { sessionId: "session-a", fileId: "shared-id", name: "result.md" };
    expect(outputKey(output)).toBe(JSON.stringify(["session-a", "shared-id"]));
    expect(outputKey({ ...output, name: "renamed.md" })).toBe(outputKey(output));
    expect(outputKey({ ...output, sessionId: "session-b" })).not.toBe(outputKey(output));
    expect(outputKey({ sessionId: "a:b", fileId: "c" })).not.toBe(outputKey({ sessionId: "a", fileId: "b:c" }));
  });
});
