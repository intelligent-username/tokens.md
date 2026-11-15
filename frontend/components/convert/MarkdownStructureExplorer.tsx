"use client";

import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type RefObject,
} from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  fetchMarkdownText,
  type MarkdownFetcher,
  type PreviewableOutput,
} from "@/lib/hooks/useMarkdownPreview";
import {
  collectStructurePage,
  MAX_STRUCTURE_PLANES,
  outputKey,
  STRUCTURE_PAGE_SIZE,
  type MarkdownPassage,
  type PassageKind,
  type StructurePage,
} from "@/lib/utils/markdownStructure";
import { PreBlock } from "@/components/ui/markdown/CodeBlock";
import { markdownComponents } from "@/components/ui/markdown/MarkdownComponents";
import { mdStyle } from "@/components/ui/markdown/styles";
import styles from "./MarkdownStructureExplorer.module.css";

export interface MarkdownStructureExplorerProps {
  outputs: readonly PreviewableOutput[];
  fetcher?: MarkdownFetcher;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; content: string }
  | { status: "error"; message: string };

function passageAttributes(prefix: string, kind: PassageKind, node: ExtraProps["node"]) {
  const position = node?.position;
  const startOffset = position?.start.offset;
  const endOffset = position?.end.offset;
  if (
    !position || typeof startOffset !== "number" || typeof endOffset !== "number" ||
    !Number.isSafeInteger(startOffset) || !Number.isSafeInteger(endOffset) ||
    startOffset < 0 || endOffset < startOffset ||
    !Number.isSafeInteger(position.start.line) || !Number.isSafeInteger(position.end.line) ||
    position.start.line < 1 || position.end.line < position.start.line
  ) {
    return {};
  }
  return {
    id: `${prefix}-${kind}-${startOffset}`,
    "data-passage-kind": kind,
    "data-start-offset": startOffset,
    "data-end-offset": endOffset,
    "data-start-line": position.start.line,
    "data-end-line": position.end.line,
    tabIndex: -1,
  };
}

/** Created once per reading document, never in response to selection or paging. */
export function createPassageComponents(prefix: string): Components {
  const heading = (Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") =>
    function PassageHeading({ node, ...props }: ComponentPropsWithoutRef<"h1"> & ExtraProps) {
      return <Tag {...props} {...passageAttributes(prefix, "heading", node)} />;
    };
  const SharedTable = markdownComponents.table;
  return {
    ...markdownComponents,
    // Reading mounts while hidden. Never forward an image URL to the DOM,
    // including same-origin/localhost URLs; descriptions remain readable.
    img: ({ alt }) => (
      <span
        className={styles.imagePlaceholder}
        data-markdown-image="blocked"
        role="img"
        aria-label={alt ? `${alt} (image not loaded)` : "Image not loaded"}
      >
        {alt || "Image"} <span className={styles.imageNotice}>(image not loaded)</span>
      </span>
    ),
    h1: heading("h1"),
    h2: heading("h2"),
    h3: heading("h3"),
    h4: heading("h4"),
    h5: heading("h5"),
    h6: heading("h6"),
    p: ({ node, ...props }) => <p {...props} {...passageAttributes(prefix, "paragraph", node)} />,
    pre: ({ node, children }) => (
      <div {...passageAttributes(prefix, "code", node)}>
        {/* PreBlock intentionally accepts only children, not DOM attributes. */}
        <PreBlock>{children}</PreBlock>
      </div>
    ),
    table: ({ node, ...props }) => (
      <div {...passageAttributes(prefix, "table", node)}>
        {typeof SharedTable === "function" ? <SharedTable {...props} node={node} /> : <table {...props} />}
      </div>
    ),
  };
}

const ReadingDocument = memo(function ReadingDocument({
  content,
  prefix,
  rootRef,
}: {
  content: string;
  prefix: string;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const components = useMemo(() => createPassageComponents(prefix), [prefix]);
  return (
    <div ref={rootRef} className={styles.readingDocument} style={mdStyle}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

function passageName(passage: MarkdownPassage): string {
  if (passage.kind === "heading") return passage.headingLevel ? `Heading ${passage.headingLevel}` : "Heading";
  if (passage.kind === "table") return "Table";
  if (passage.kind === "code") return "Code";
  return "Paragraph";
}

function passageLines(passage: MarkdownPassage): string {
  return passage.startLine === passage.endLine
    ? `Line ${passage.startLine}`
    : `Lines ${passage.startLine}–${passage.endLine}`;
}

function passageCue(passage: MarkdownPassage): string {
  if (passage.kind === "heading") return `H${passage.headingLevel ?? ""}`;
  if (passage.kind === "table") return "┬";
  if (passage.kind === "code") return "</>";
  return "¶";
}

function PassageMap({
  structure,
  selectedId,
  selectPassage,
}: {
  structure: StructurePage;
  selectedId: string | null;
  selectPassage: (id: string) => void;
}) {
  const planes = structure.passages.slice(0, MAX_STRUCTURE_PLANES);
  return (
    <figure className={styles.map}>
      <figcaption className={styles.mapCaption}>
        <strong>Passage map</strong>
        <span>{planes.length} passages from this outline page. Select one to read in context.</span>
      </figcaption>
      <div className={styles.planes} role="group" aria-label="Passage map">
        {planes.map((passage) => (
          <button
            key={passage.id}
            type="button"
            className={styles.plane}
            data-kind={passage.kind}
            data-current={selectedId === passage.id ? "true" : undefined}
            aria-label={`Read ${passageName(passage).toLowerCase()}, ${passageLines(passage).toLowerCase()}: ${passage.label}`}
            onClick={() => selectPassage(passage.id)}
          >
            <span className={styles.planeHeader}>
              <span className={styles.cue} aria-hidden="true">{passageCue(passage)}</span>
              <span>{passageName(passage)}</span>
            </span>
            <span className={styles.planeExcerpt}>{passage.label}</span>
            <span className={styles.lines}>{passageLines(passage)}</span>
          </button>
        ))}
      </div>
    </figure>
  );
}

function LoadedDocument({ content }: { content: string }) {
  const prefix = useId();
  const readingRef = useRef<HTMLDivElement>(null);
  const structureButtonRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<"structure" | "reading">("structure");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [structure, setStructure] = useState<StructurePage | null>(null);

  useEffect(() => {
    if (!readingRef.current) return;
    const next = collectStructurePage(readingRef.current, page);
    setStructure(next);
    if (next.page !== page) setPage(next.page);
  }, [content, page]);

  useEffect(() => {
    const root = readingRef.current;
    if (view !== "reading" || !selectedId || !root) return;
    // Compare generated IDs directly: no source text or CSS selector escaping.
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const target = node as HTMLElement;
      if (target.id === selectedId && target.hasAttribute("data-passage-kind")) {
        target.setAttribute("data-selected", "true");
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "nearest", behavior: "auto" });
        return () => target.removeAttribute("data-selected");
      }
      node = walker.nextNode();
    }
  }, [selectedId, view]);

  const selectPassage = (id: string) => {
    setSelectedId(id);
    setView("reading");
  };
  const showStructure = () => {
    setView("structure");
    structureButtonRef.current?.focus({ preventScroll: true });
  };
  const start = structure && structure.total > 0 ? structure.page * STRUCTURE_PAGE_SIZE + 1 : 0;
  const end = structure ? Math.min((structure.page + 1) * STRUCTURE_PAGE_SIZE, structure.total) : 0;

  return (
    <>
      <div className={styles.viewBar}>
        <div className={styles.viewGroup} role="group" aria-label="Markdown view">
          <button
            ref={structureButtonRef}
            type="button"
            aria-pressed={view === "structure"}
            onClick={() => setView("structure")}
          >
            Structure
          </button>
          <button type="button" aria-pressed={view === "reading"} onClick={() => setView("reading")}>
            Reading
          </button>
        </div>
        <span className={styles.viewHint}>{view === "structure" ? "Explore rendered blocks" : "Complete Markdown output"}</span>
      </div>

      <div hidden={view !== "structure"} className={styles.structure}>
        {!structure ? (
          <p className={styles.message}>Indexing rendered passages…</p>
        ) : structure.total === 0 ? (
          <p className={styles.message}>No heading, paragraph, table or code passages to outline. Open Reading to view the complete output.</p>
        ) : (
          <div className={styles.structureLayout}>
            <PassageMap structure={structure} selectedId={selectedId} selectPassage={selectPassage} />
            <section className={styles.outline} aria-label="Passage outline">
              <div className={styles.outlineHeader}>
                <h3>Outline</h3>
                <p>Showing passages {start}–{end} of {structure.total}</p>
              </div>
              <ol className={styles.outlineList} start={start}>
                {structure.passages.map((passage) => (
                  <li key={passage.id}>
                    <button
                      type="button"
                      className={styles.outlineButton}
                      aria-current={selectedId === passage.id ? "true" : undefined}
                      onClick={() => selectPassage(passage.id)}
                    >
                      <span className={styles.outlineMeta}>
                        <span>{passageName(passage)}</span>
                        <span className={styles.lines}>{passageLines(passage)}</span>
                      </span>
                      <span className={styles.outlineExcerpt}>{passage.label}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <nav className={styles.pagination} aria-label="Outline pages">
                <button
                  type="button"
                  className={styles.control}
                  disabled={structure.page === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  Previous
                </button>
                <span>Page {structure.page + 1} of {Math.ceil(structure.total / STRUCTURE_PAGE_SIZE)}</span>
                <button
                  type="button"
                  className={styles.control}
                  disabled={end === structure.total}
                  onClick={() => setPage((current) => Math.min(Math.ceil(structure.total / STRUCTURE_PAGE_SIZE) - 1, current + 1))}
                >
                  Next
                </button>
              </nav>
            </section>
          </div>
        )}
      </div>

      {/* Visibility belongs outside the memoized render, preserving its DOM and copy state. */}
      <div hidden={view !== "reading"} className={styles.reading}>
        <div className={styles.readingToolbar}>
          <button type="button" className={styles.control} onClick={showStructure}>Outline</button>
          <span>Full document</span>
        </div>
        <p className={styles.imagePolicy}>Images are not loaded automatically. Their alternative text is preserved.</p>
        <ReadingDocument content={content} prefix={prefix} rootRef={readingRef} />
      </div>
    </>
  );
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Could not load this Markdown output.";
}

function OutputDocument({ output, fetcher }: { output: PreviewableOutput; fetcher: MarkdownFetcher }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    // The shared fetcher cannot abort transport. Cleanup invalidates every commit,
    // including rejections and synchronous throws from an injected fetcher.
    void (async () => {
      try {
        const content = await fetcher(output);
        if (active) setState({ status: "ready", content });
      } catch (error: unknown) {
        if (active) setState({ status: "error", message: toMessage(error) });
      }
    })();
    return () => { active = false; };
    // A descriptor/name-only change must not reload the same session/file.
  }, [fetcher, output.sessionId, output.fileId, retryVersion]);

  if (state.status === "loading") {
    return <div className={styles.message} role="region" aria-label="Loading Markdown output" aria-busy="true" aria-live="polite" aria-atomic="true">Loading Markdown…</div>;
  }
  if (state.status === "error") {
    return (
      <div className={styles.message} role="region" aria-label="Markdown loading error" aria-live="polite" aria-atomic="true">
        <strong>Markdown could not be loaded</strong>
        <p>{state.message}</p>
        <button
          type="button"
          className={styles.control}
          onClick={() => {
            setState({ status: "loading" });
            setRetryVersion((current) => current + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  if (state.content.length === 0) {
    return <p className={styles.message}>This output contains no Markdown</p>;
  }
  return <LoadedDocument content={state.content} />;
}

export function MarkdownStructureExplorer({
  outputs,
  fetcher = fetchMarkdownText,
}: MarkdownStructureExplorerProps) {
  const id = useId();
  const [selectedKey, setSelectedKey] = useState<string | null>(() => outputs[0] ? outputKey(outputs[0]) : null);
  const selectedOutput = outputs.find((output) => outputKey(output) === selectedKey) ?? outputs[0];
  const resolvedKey = selectedOutput ? outputKey(selectedOutput) : null;

  useEffect(() => {
    // Commit the fallback too, so a removed output cannot reclaim selection later.
    setSelectedKey(resolvedKey);
  }, [resolvedKey]);

  return (
    <section className={styles.explorer} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <h2 id={`${id}-title`}>Explore Markdown</h2>
        {selectedOutput ? (
          <div className={styles.outputField}>
            <label htmlFor={`${id}-output`}>Output</label>
            <select
              id={`${id}-output`}
              value={resolvedKey ?? ""}
              onChange={(event) => setSelectedKey(event.target.value)}
            >
              {outputs.map((output, index) => (
                <option key={outputKey(output)} value={outputKey(output)}>
                  {output.name || `Output ${index + 1}`}
                </option>
              ))}
            </select>
            <p className={styles.outputName}>{selectedOutput.name || "Markdown output"}</p>
          </div>
        ) : null}
      </header>
      {selectedOutput && resolvedKey ? (
        <OutputDocument key={resolvedKey} output={selectedOutput} fetcher={fetcher} />
      ) : (
        <p className={styles.message}>No Markdown outputs yet. Convert a source to explore its structure.</p>
      )}
    </section>
  );
}
