import type { PreviewableOutput } from "@/lib/hooks/useMarkdownPreview";

export const STRUCTURE_PAGE_SIZE = 48;
export const MAX_STRUCTURE_PLANES = 12;
export const MAX_PASSAGE_LABEL = 96;

export type PassageKind = "heading" | "paragraph" | "table" | "code";

export interface MarkdownPassage {
  id: string;
  kind: PassageKind;
  label: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  headingLevel?: number;
}

export interface StructurePage {
  passages: readonly MarkdownPassage[];
  total: number;
  /** Zero-based outline page. */
  page: number;
}

export function outputKey(output: PreviewableOutput): string {
  return JSON.stringify([output.sessionId, output.fileId]);
}

function readInteger(element: Element, attribute: string, minimum: number): number | null {
  const raw = element.getAttribute(attribute);
  if (!raw) return null;
  // Only decimal annotations are accepted, not whitespace, exponents or hex.
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw.charCodeAt(index);
    if (character < 48 || character > 57) return null;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= minimum ? value : null;
}

function readPassagePosition(element: Element): Omit<MarkdownPassage, "label"> | null {
  const kind = element.getAttribute("data-passage-kind");
  if (kind !== "heading" && kind !== "paragraph" && kind !== "table" && kind !== "code") {
    return null;
  }
  const id = element.id;
  const startOffset = readInteger(element, "data-start-offset", 0);
  const endOffset = readInteger(element, "data-end-offset", 0);
  const startLine = readInteger(element, "data-start-line", 1);
  const endLine = readInteger(element, "data-end-line", 1);
  if (
    !id || startOffset === null || endOffset === null || startLine === null || endLine === null ||
    endOffset < startOffset || endLine < startLine
  ) {
    return null;
  }
  const tag = element.tagName.toLowerCase();
  const level = tag.length === 2 && tag[0] === "h" ? Number(tag[1]) : undefined;
  return {
    id,
    kind,
    startOffset,
    endOffset,
    startLine,
    endLine,
    ...(kind === "heading" && level !== undefined && level >= 1 && level <= 6
      ? { headingLevel: level }
      : {}),
  };
}

/** Reads at most 96 text characters, never the full block's textContent. */
export function readPassageLabel(element: Element): string {
  const kind = element.getAttribute("data-passage-kind");
  // The shared code renderer also contains a toolbar and a copy button.
  const textRoot = kind === "code" ? element.querySelector("pre code") : element;
  let label = "";
  if (textRoot) {
    const walker = element.ownerDocument.createTreeWalker(textRoot, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && label.length < MAX_PASSAGE_LABEL) {
      const remaining = MAX_PASSAGE_LABEL - label.length;
      label += (node.nodeValue ?? "").slice(0, remaining);
      if (label.length === MAX_PASSAGE_LABEL) break;
      node = walker.nextNode();
    }
  }
  const excerpt = label.trim();
  if (excerpt) return excerpt;
  const name = kind === "heading" ? "Heading" : kind === "table" ? "Table" : kind === "code" ? "Code" : "Paragraph";
  const line = readInteger(element, "data-start-line", 1);
  return line === null ? name : `${name} at line ${line}`;
}

export function readPassage(element: Element): MarkdownPassage | null {
  const position = readPassagePosition(element);
  return position ? { ...position, label: readPassageLabel(element) } : null;
}

/**
 * Walks the rendered document in source order. Only the requested page retains
 * records or reads labels; large documents do not create an all-passages array.
 */
export function collectStructurePage(root: HTMLElement, page: number): StructurePage {
  const requestedPage = Number.isSafeInteger(page) ? Math.max(0, page) : 0;
  const start = requestedPage * STRUCTURE_PAGE_SIZE;
  const passages: MarkdownPassage[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  let total = 0;
  while (node) {
    const element = node as Element;
    const position = readPassagePosition(element);
    if (position) {
      if (total >= start && passages.length < STRUCTURE_PAGE_SIZE) {
        passages.push({ ...position, label: readPassageLabel(element) });
      }
      total += 1;
    }
    node = walker.nextNode();
  }
  const lastPage = Math.max(0, Math.ceil(total / STRUCTURE_PAGE_SIZE) - 1);
  // A stale/out-of-range page needs a second DOM walk, never a second parse.
  if (requestedPage > lastPage) return collectStructurePage(root, lastPage);
  return { passages, total, page: requestedPage };
}
