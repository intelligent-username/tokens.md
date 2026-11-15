"use client";

import { useId, useState, type CSSProperties } from "react";
import styles from "./ImpossibleManuscript.module.css";

export type ManuscriptPhase = "idle" | "selected" | "converting" | "complete" | "error";

export interface ImpossibleManuscriptProps {
  phase: ManuscriptPhase;
  engaged: boolean;
  sourceCount: number;
  sourceExtensions: readonly string[];
  outputCount: number;
}

const PLANE_COUNT = 7;
const PERSPECTIVE_PX = 900;
const SHEET_WIDTH = 420;
const SHEET_HEIGHT = 240;
const EDGE_OUTSET = 1.5;
const EDGE_OFFSET = 0.75;
const EDGE_DEPTH = 1;
const APERTURE_CLEARANCE = 1.25;

// Source-type hues, tinted into the stock rather than painted on it so the
// cut letterforms keep their contrast in both themes.
const SOURCE_HUES: Record<string, string> = {
  pdf: "#e05252",
  docx: "#4f6eda", doc: "#4f6eda", rtf: "#4f6eda", odt: "#4f6eda",
  pptx: "#e08a3c", ppt: "#e08a3c", odp: "#e08a3c",
  md: "#3aa0d8", markdown: "#3aa0d8", mdx: "#3aa0d8",
  xlsx: "#3f9e6b", xls: "#3f9e6b", ods: "#3f9e6b", csv: "#3f9e6b",
  epub: "#8b6bd0", azw3: "#8b6bd0", azw4: "#8b6bd0",
  html: "#c9952f", htm: "#c9952f", xml: "#c9952f",
  msg: "#2f9e9e", eml: "#2f9e9e", srt: "#2f9e9e", vtt: "#2f9e9e",
  json: "#a68a2a", yaml: "#a68a2a", yml: "#a68a2a", py: "#a68a2a",
  js: "#a68a2a", ts: "#a68a2a", jsx: "#a68a2a", tsx: "#a68a2a",
  tex: "#a68a2a", ipynb: "#a68a2a",
  zip: "#a5703f", tar: "#a5703f", gz: "#a5703f", tgz: "#a5703f", bz2: "#a5703f",
  txt: "#8a93a6",
};

export function sourceHue(extension: string): string | undefined {
  return SOURCE_HUES[extension.trim().toLowerCase().replace(/^\./, "")];
}

/**
 * Front-to-back hues for the seven sheets. The first upload owns the front
 * sheet, so few files tint only the nearest ones. Above seven the hues are
 * apportioned by count (minimum one sheet each) while keeping upload order.
 */
export function manuscriptHues(extensions: readonly string[]): (string | undefined)[] {
  if (extensions.length === 0) return [];
  if (extensions.length <= PLANE_COUNT) return extensions.map(sourceHue);

  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const extension of extensions) {
    const key = extension.trim().toLowerCase();
    if (!counts.has(key)) order.push(key);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // More distinct types than sheets: keep the most common, still in first-seen
  // order, so every remaining type is represented at least once.
  let groups = order.map((key) => ({ key, count: counts.get(key) ?? 0 }));
  if (groups.length > PLANE_COUNT) {
    const keep = new Set([...groups].sort((a, b) => b.count - a.count).slice(0, PLANE_COUNT).map((group) => group.key));
    groups = groups.filter((group) => keep.has(group.key));
  }

  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const slots = groups.map(() => 1);
  for (let free = PLANE_COUNT - groups.length; free > 0; free -= 1) {
    let best = 0;
    for (let index = 1; index < groups.length; index += 1) {
      const score = (groups[index].count / total) * PLANE_COUNT - slots[index];
      const bestScore = (groups[best].count / total) * PLANE_COUNT - slots[best];
      if (score > bestScore) best = index;
    }
    slots[best] += 1;
  }

  return groups.flatMap((group, index) => Array.from({ length: slots[index] }, () => sourceHue(group.key)));
}


type Point = readonly [number, number];
type Contour = readonly Point[];
type GeometryStyle = CSSProperties & { [key: `--${string}`]: string | number };

// Clockwise, orthogonal contours in a fixed screen-space coordinate system.
// These are cutting templates, not font glyphs. The fourth contour restores
// the enclosed counter of d via even-odd parity (sheet → hole → island).
const APERTURES: readonly Contour[] = [
  [[0.19, 0.63], [0.245, 0.63], [0.245, 0.73], [0.19, 0.73]],
  [
    [0.30, 0.73], [0.30, 0.39], [0.59, 0.39], [0.59, 0.73],
    [0.53, 0.73], [0.53, 0.49], [0.475, 0.49], [0.475, 0.73],
    [0.415, 0.73], [0.415, 0.49], [0.36, 0.49], [0.36, 0.73],
  ],
  [
    [0.65, 0.39], [0.79, 0.39], [0.79, 0.23],
    [0.85, 0.23], [0.85, 0.73], [0.65, 0.73],
  ],
  [[0.71, 0.49], [0.79, 0.49], [0.79, 0.63], [0.71, 0.63]],
];

function offsetContour(contour: Contour, padding: number): Point[] {
  // Offset perpendicular edges, rather than scaling a glyph's bounding box:
  // scaling would put emerald paint back into the concave gaps of m.
  return contour.map(([x, y], index) => {
    const previous = contour[(index + contour.length - 1) % contour.length];
    const next = contour[(index + 1) % contour.length];
    return [
      x * SHEET_WIDTH + padding * (Math.sign(y - previous[1]) + Math.sign(next[1] - y)),
      y * SHEET_HEIGHT - padding * (Math.sign(x - previous[0]) + Math.sign(next[0] - x)),
    ];
  });
}

function cutPath(x: number, y: number, z: number, backing: boolean): string {
  const outset = backing ? EDGE_OUTSET : 0;
  const offset = backing ? EDGE_OFFSET : 0;
  const depth = z - (backing ? EDGE_DEPTH : 0);
  const perspectiveScale = PERSPECTIVE_PX / (PERSPECTIVE_PX - depth);
  const width = SHEET_WIDTH + outset * 2;
  const height = SHEET_HEIGHT + outset * 2;
  const holes = APERTURES.map((contour, index) => {
    // Enlarge every backing hole, but shrink its counter island. Both its
    // physical edge offset and its different depth are inverse-projected.
    const padding = backing ? APERTURE_CLEARANCE * (index === 3 ? -1 : 1) : 0;
    return offsetContour(contour, padding).map(([screenX, screenY], pointIndex) => {
      const localX = 0.5 + ((screenX - SHEET_WIDTH / 2) / perspectiveScale - x - offset) / width;
      const localY = 0.5 + ((screenY - SHEET_HEIGHT / 2) / perspectiveScale - y - offset) / height;
      return `${pointIndex === 0 ? "M" : "L"}${localX.toFixed(6)} ${localY.toFixed(6)}`;
    }).join(" ") + " Z";
  });

  // A sheared-off corner makes the sheets read as cut stock, not UI cards.
  return `M0 0 L0.94 0 L1 0.1 L1 1 L0 1 Z ${holes.join(" ")}`;
}

// Geometry is bounded and computed once, independently of source documents.
const PLANES = Array.from({ length: PLANE_COUNT }, (_, index) => {
  const step = index - (PLANE_COUNT - 1) / 2;
  const x = -14 * step;
  const y = 9 * step;
  const z = 24 * step;
  const style: GeometryStyle = {
    "--x": `${x}px`,
    "--y": `${y}px`,
    "--z": `${z}px`,
    "--open-x": `${-10 * step}px`,
    "--open-y": `${-22 * step}px`,
    "--open-z": `${8 * step}px`,
    "--tilt-x": `${-4 + step * 3}deg`,
    "--tilt-y": `${-8 + step * 4}deg`,
    "--tilt-z": `${step * 1.5}deg`,
    "--paper-tone": `${26 + index * 3}%`,
  };
  return { index, style, face: cutPath(x, y, z, false), backing: cutPath(x, y, z, true) };
});

const GEOMETRY_STYLE: GeometryStyle = {
  "--perspective": `${PERSPECTIVE_PX}px`,
  "--sheet-width": `${SHEET_WIDTH}px`,
  "--sheet-height": `${SHEET_HEIGHT}px`,
  "--edge-outset": `${EDGE_OUTSET}px`,
  "--edge-offset": `${EDGE_OFFSET}px`,
  "--edge-depth": `${-EDGE_DEPTH}px`,
};

function sourceLabel(extension: string): string {
  const normalized = extension.trim().toLowerCase().replace(/^\./, "");
  if (normalized === "url" || /^https?:\/\//.test(normalized)) return "URL";
  if (!normalized || normalized === "file" || !/^[a-z0-9]{1,12}$/.test(normalized)) return "File";
  return `.${normalized}`;
}

function sourceLabels(extensions: readonly string[], count: number): string[] {
  if (count === 0) return [];
  const labels = new Set<string>();
  for (const extension of extensions) {
    labels.add(sourceLabel(extension));
    if (labels.size === 6) break;
  }
  return labels.size > 0 ? [...labels] : ["File"];
}

function caption(phase: ManuscriptPhase, sources: string, outputs: number): string {
  switch (phase) {
    case "idle": return "Illustrative document structure";
    case "selected": return `${sources} selected`;
    case "converting": return `Converting ${sources}…`;
    case "complete": return `${outputs} Markdown ${outputs === 1 ? "output" : "outputs"} available`;
    case "error": return "Conversion needs attention";
  }
}

/** A noninteractive, illustrative leaf. No document content enters its geometry. */
export function ImpossibleManuscript({
  phase,
  engaged,
  sourceCount,
  sourceExtensions,
  outputCount,
}: ImpossibleManuscriptProps) {
  const id = `manuscript-${useId().replace(/:/g, "")}`;
  const [interaction, setInteraction] = useState({
    phase,
    engaged,
    completedWhileEngaged: phase === "complete" && engaged,
  });
  if (interaction.phase !== phase || interaction.engaged !== engaged) {
    // Close on success even if focus/drag was held throughout conversion.
    // A release followed by a new engagement may open that completed pose.
    // This guarded render adjustment commits no stale pose or extra effect.
    setInteraction({
      phase,
      engaged,
      completedWhileEngaged: phase === "complete" && engaged
        && (interaction.phase !== "complete" || interaction.completedWhileEngaged),
    });
  }
  const labels = sourceLabels(sourceExtensions, sourceCount);
  const urlsOnly = sourceExtensions.length > 0 && sourceExtensions.every((extension) => sourceLabel(extension) === "URL");
  const sources = `${sourceCount} ${urlsOnly ? (sourceCount === 1 ? "URL" : "URLs") : (sourceCount === 1 ? "source" : "sources")}`;
  const exploded = phase === "converting" || phase === "error" || phase === "selected"
    || (engaged && !interaction.completedWhileEngaged);
  // Front sheet first: the initial upload stays the most prominent.
  const hues = manuscriptHues(sourceCount > 0 ? sourceExtensions : []);

  return (
    <figure
      className={styles.manuscript}
      style={GEOMETRY_STYLE}
      data-phase={phase}
      data-pose={exploded ? "exploded" : "aligned"}
      data-engaged={engaged}
    >
      <div className={styles.viewport} aria-hidden="true">
        <svg className={styles.templates} width="0" height="0" focusable="false">
          <defs>
            {PLANES.map((plane) => (
              <g key={plane.index}>
                <clipPath id={`${id}-face-${plane.index}`} clipPathUnits="objectBoundingBox">
                  <path d={plane.face} clipRule="evenodd" fillRule="evenodd" />
                </clipPath>
                <clipPath id={`${id}-backing-${plane.index}`} clipPathUnits="objectBoundingBox">
                  <path d={plane.backing} clipRule="evenodd" fillRule="evenodd" />
                </clipPath>
              </g>
            ))}
          </defs>
        </svg>
        <div className={styles.scene}>
          <div className={styles.assembly}>
            {PLANES.map((plane) => {
              // Plane 0 is the deepest sheet; the last plane faces the viewer.
              const hue = hues[PLANE_COUNT - 1 - plane.index];
              return (
                <div
                  key={plane.index}
                  className={styles.plane}
                  style={hue ? { ...plane.style, "--paper-hue": hue } : plane.style}
                  data-manuscript-plane={plane.index}
                  data-source-hue={hue}
                >
                  <div
                    className={styles.backing}
                    style={{ clipPath: `url("#${id}-backing-${plane.index}")` }}
                    data-manuscript-backing=""
                  />
                  <div
                    className={styles.face}
                    style={{ clipPath: `url("#${id}-face-${plane.index}")` }}
                    data-manuscript-face=""
                  >
                    <span className={styles.headingMark} data-manuscript-mark="">#</span>
                    <span className={styles.headingRules} data-manuscript-mark="" />
                    <span className={styles.tableMark} data-manuscript-mark="" />
                    <span className={styles.codeMark} data-manuscript-mark="">{"{ }"}</span>
                    <span className={styles.bodyRules} data-manuscript-mark="" />
                    <span className={styles.punctuationMark} data-manuscript-mark="">[]</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <figcaption className={styles.caption}>
        <span className={phase === "idle" ? "sr-only" : styles.captionTitle}>{caption(phase, sources, outputCount)}</span>
        {phase !== "idle" ? (
          <span className={styles.captionDetail}>
            {phase === "complete" || phase === "error" ? `${sources} selected. ` : ""}
            Illustrative sheets
          </span>
        ) : null}
        {labels.length > 0 ? (
          <span className={styles.sourceLabels} aria-label="Source types">
            {labels.map((label) => <span key={label} data-source-extension="">{label}</span>)}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
