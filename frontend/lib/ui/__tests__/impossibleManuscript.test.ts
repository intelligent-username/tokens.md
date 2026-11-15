import React from "react";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  ImpossibleManuscript,
  type ImpossibleManuscriptProps,
  type ManuscriptPhase,
} from "@/components/convert/ImpossibleManuscript";

const idle: ImpossibleManuscriptProps = {
  phase: "idle", engaged: false, sourceCount: 0, sourceExtensions: [], outputCount: 0,
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("impossible manuscript", () => {
  it("uses bounded cutout geometry with an honest caption and no idle work or live status", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(React.createElement(ImpossibleManuscript, idle));
    const planes = container.querySelectorAll("[data-manuscript-plane]");
    expect(planes).toHaveLength(7);
    for (const plane of planes) {
      expect(plane.querySelectorAll("[data-manuscript-face]")).toHaveLength(1);
      expect(plane.querySelectorAll("[data-manuscript-backing]")).toHaveLength(1);
      expect(plane.querySelectorAll("[data-manuscript-mark]").length).toBeLessThanOrEqual(6);
      expect(plane.closest('[aria-hidden="true"]')).toBeTruthy();
    }
    const clips = container.querySelectorAll("clipPath");
    expect(clips).toHaveLength(14);
    for (const clip of clips) {
      const path = clip.querySelector("path")!;
      expect(clip.getAttribute("clipPathUnits")).toBe("objectBoundingBox");
      expect(path.getAttribute("clip-rule")).toBe("evenodd");
      // Each compound path has the sheet plus apertures/counter, rather than a painted glyph.
      expect((path.getAttribute("d")?.match(/M/g) ?? []).length).toBeGreaterThan(1);
    }
    for (const surface of container.querySelectorAll<HTMLElement>("[data-manuscript-face], [data-manuscript-backing]")) {
      expect(Array.from(clips).some((clip) => surface.style.clipPath.includes(clip.id))).toBe(true);
    }
    expect(container.querySelector("svg text")).toBeNull();
    expect(container.textContent).not.toContain(".md");
    expect(screen.getByText("Illustrative document structure").closest('[aria-hidden="true"]')).toBeNull();
    expect(container.querySelector('[role="status"], [aria-live], button, input, a')).toBeNull();
    rerender(React.createElement(ImpossibleManuscript, idle));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("scopes clip IDs independently for multiple mounted sculptures", () => {
    const { container } = render(React.createElement(React.Fragment, null,
      React.createElement(ImpossibleManuscript, idle),
      React.createElement(ImpossibleManuscript, idle)));
    const ids = Array.from(container.querySelectorAll("clipPath"), (clip) => clip.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each([
    ["idle", "aligned", "Illustrative document structure"],
    ["selected", "exploded", "2 sources selected"],
    ["converting", "exploded", "Converting 2 sources…"],
    ["complete", "aligned", "1 Markdown output available"],
    ["error", "exploded", "Conversion needs attention"],
  ] as const)("maps %s to its pose and truthful caption", (phase: ManuscriptPhase, pose, caption) => {
    const { container } = render(React.createElement(ImpossibleManuscript, {
      ...idle, phase, sourceCount: 2, sourceExtensions: ["txt", "pdf"], outputCount: 1,
    }));
    expect(container.querySelector("figure")?.dataset.phase).toBe(phase);
    expect(container.querySelector("figure")?.dataset.pose).toBe(pose);
    expect(screen.getByText(caption)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("closes immediately on completion despite held focus and reopens on new engagement", () => {
    const { container, rerender } = render(React.createElement(ImpossibleManuscript, { ...idle, engaged: true }));
    const figure = container.querySelector("figure")!;
    expect(figure.dataset.pose).toBe("exploded");
    const converting: ImpossibleManuscriptProps = { ...idle, phase: "converting", engaged: true, sourceCount: 1 };
    rerender(React.createElement(ImpossibleManuscript, converting));
    expect(figure.dataset.pose).toBe("exploded");
    const complete: ImpossibleManuscriptProps = { ...converting, phase: "complete", outputCount: 1 };
    rerender(React.createElement(ImpossibleManuscript, complete));
    expect(figure.dataset.pose).toBe("aligned");
    expect(screen.getByText("1 Markdown output available")).toBeTruthy();
    rerender(React.createElement(ImpossibleManuscript, complete));
    expect(figure.dataset.pose).toBe("aligned");
    rerender(React.createElement(ImpossibleManuscript, { ...complete, engaged: false }));
    rerender(React.createElement(ImpossibleManuscript, complete));
    expect(figure.dataset.pose).toBe("exploded");
    expect(container.querySelector("figure")).toBe(figure);
  });

  it("bounds and normalizes source labels without exposing URL paths or document names", () => {
    const { container, rerender } = render(React.createElement(ImpossibleManuscript, {
      ...idle, phase: "selected", sourceCount: 200,
      sourceExtensions: [" .PDF ", "pdf", "txt", "", "https://example.com/private", "csv", "docx", "xlsx", "secret-document-name.txt"],
    }));
    expect(Array.from(container.querySelectorAll("[data-source-extension]"), (label) => label.textContent))
      .toEqual([".pdf", ".txt", "File", "URL", ".csv", ".docx"]);
    expect(screen.getByText("200 sources selected")).toBeTruthy();
    expect(container.textContent).not.toContain("private");
    expect(container.textContent).not.toContain("secret-document-name");
    expect(container.querySelectorAll("[data-manuscript-plane]")).toHaveLength(7);
    rerender(React.createElement(ImpossibleManuscript, { ...idle, phase: "selected", sourceCount: 1, sourceExtensions: ["URL"] }));
    expect(screen.getByText("1 URL selected")).toBeTruthy();
  });

  it("declares static reduced-motion and compact camera rules", () => {
    // Static CSS checks cannot establish perspective legibility, overflow or contrast in a browser.
    const css = readFileSync(new URL("../../../components/convert/ImpossibleManuscript.module.css", import.meta.url), "utf8");
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition:\s*none/);
    expect(css).toMatch(/@container\s*\(max-width:\s*\d+px\)[\s\S]*?--explosion:\s*0\.\d+/);
    expect(css).toMatch(/transform-style:\s*preserve-3d/);
    expect(css).not.toMatch(/@keyframes|animation\s*:/);
  });
});
