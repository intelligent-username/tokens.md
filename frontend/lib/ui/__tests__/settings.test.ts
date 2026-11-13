import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OptionsPanel } from "@/components/convert/OptionsPanel";
import { UrlInputCard } from "@/components/convert/UrlInputCard";
import type { BudgetUnit } from "@/components/ui/BudgetInput";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function SettingsHarness() {
  const [extensions, setExtensions] = useState("");
  const [pages, setPages] = useState("");
  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [budgetValue, setBudgetValue] = useState(100);
  const [budgetUnit, setBudgetUnit] = useState<BudgetUnit>("KB");
  const [recursive, setRecursive] = useState(true);
  const [stripHeadersFooters, setStripHeadersFooters] = useState(false);
  const [writeImages, setWriteImages] = useState(false);
  const [mergeEnabled, setMergeEnabled] = useState(false);
  const [includeToc, setIncludeToc] = useState(true);

  return React.createElement(OptionsPanel, {
    extensions, setExtensions, pages, setPages, budgetEnabled, setBudgetEnabled,
    budgetValue, setBudgetValue, budgetUnit, setBudgetUnit, recursive, setRecursive,
    stripHeadersFooters, setStripHeadersFooters, writeImages, setWriteImages,
    mergeEnabled, setMergeEnabled, includeToc, setIncludeToc,
  });
}

describe("settings accessibility", () => {
  it("exposes accordion state and focusable, editable fields", async () => {
    const user = userEvent.setup();
    render(React.createElement(SettingsHarness));
    const settings = screen.getByRole("button", { name: "Settings" });
    expect(settings.getAttribute("aria-expanded")).toBe("false");
    const panel = document.getElementById(settings.getAttribute("aria-controls")!);
    expect(panel?.hidden).toBe(true);

    await user.click(settings);
    expect(settings.getAttribute("aria-expanded")).toBe("true");
    expect(panel?.hidden).toBe(false);
    const extensions = screen.getByRole("textbox", { name: "Extensions (comma-separated)" });
    const pages = screen.getByRole("textbox", { name: "Pages selection" });
    await user.click(extensions);
    expect(document.activeElement).toBe(extensions);
    await user.type(extensions, "pdf, md");
    expect((extensions as HTMLInputElement).value).toBe("pdf, md");
    await user.click(pages);
    expect(document.activeElement).toBe(pages);
    await user.type(pages, "1-3");
    expect((pages as HTMLInputElement).value).toBe("1-3");

    await user.click(settings);
    expect(settings.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("textbox", { name: "Pages selection" })).toBeNull();
  });

  it("operates the budget switch by keyboard and exposes the range and unit state", async () => {
    const user = userEvent.setup();
    render(React.createElement(SettingsHarness));
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const toggle = screen.getByRole("switch", { name: "Token budget ceiling" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    act(() => { toggle.focus(); });
    expect(document.activeElement).toBe(toggle);
    expect(screen.getByRole("tooltip").textContent).toContain("maximum token ceiling");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.keyboard(" ");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("slider", { name: "Target size budget (KB)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "KB" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "MB" }).getAttribute("aria-pressed")).toBe("false");
    await user.click(screen.getByRole("button", { name: "MB" }));
    expect(screen.getByRole("slider", { name: "Target size budget (MB)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "KB" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "MB" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the URL example static over time and rerenders", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { rerender } = render(React.createElement(UrlInputCard, { value: "", onChange }));
    const input = screen.getByRole("textbox", { name: "Web Page or Git Repository URL" });
    expect(input.getAttribute("placeholder")).toBe("https://example.com/article");
    act(() => { vi.advanceTimersByTime(30000); });
    expect(input.getAttribute("placeholder")).toBe("https://example.com/article");
    rerender(React.createElement(UrlInputCard, { value: "https://example.org", onChange }));
    expect(input.getAttribute("placeholder")).toBe("https://example.com/article");
  });
});
