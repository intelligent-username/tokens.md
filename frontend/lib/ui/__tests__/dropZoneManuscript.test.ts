import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropZone, type DropZoneVisualState } from "@/components/ui/DropZone";
import copy from "@/lib/copy";

function visual(state: DropZoneVisualState) {
  return React.createElement("span", {
    "data-testid": "manuscript-slot",
    "data-dragging": state.dragging,
    "data-focused": state.focused,
    "data-busy": state.busy,
    "data-disabled": state.disabled,
  }, "Illustrative sheets");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("dropzone manuscript slot", () => {
  it("passes focus, drag and disabled state without nesting interactive controls", () => {
    const onFiles = vi.fn();
    const { rerender, container } = render(React.createElement(DropZone, { label: "Choose sources", onFiles, renderVisual: visual }));
    const zone = screen.getByRole("button", { name: "Choose sources" });
    const slot = screen.getByTestId("manuscript-slot");
    expect(slot.dataset.focused).toBe("false");
    fireEvent.focus(zone);
    expect(slot.dataset.focused).toBe("true");
    const input = container.querySelector("input")!;
    fireEvent.blur(zone, { relatedTarget: input });
    expect(slot.dataset.focused).toBe("true");
    fireEvent.blur(zone, { relatedTarget: document.body });
    expect(slot.dataset.focused).toBe("false");
    const dataTransfer = { dropEffect: "none" };
    fireEvent.dragOver(zone, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("copy");
    expect(slot.dataset.dragging).toBe("true");
    fireEvent.dragLeave(zone);
    expect(slot.dataset.dragging).toBe("false");
    expect(slot.querySelector("button, input, a, select, [tabindex]")).toBeNull();
    expect(zone.querySelector("button, select, a, [role='button']")).toBeNull();
    rerender(React.createElement(DropZone, { label: "Choose sources", onFiles, renderVisual: visual, disabled: true }));
    expect(slot.dataset.disabled).toBe("true");
    expect(zone.getAttribute("aria-disabled")).toBe("true");
    expect(zone.tabIndex).toBe(-1);
    expect(input.disabled).toBe(true);
    fireEvent.dragOver(zone, { dataTransfer });
    expect(slot.dataset.dragging).toBe("false");
    fireEvent.drop(zone, { dataTransfer: { items: [], files: [new File(["x"], "ignored.txt")] } });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("keeps the default icon and activates the picker with Enter and Space", async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    const { container, rerender } = render(React.createElement(DropZone, { label: "Choose sources", onFiles }));
    const zone = screen.getByRole("button", { name: "Choose sources" });
    expect(zone.querySelector("svg")).toBeTruthy();
    expect(screen.queryByTestId("manuscript-slot")).toBeNull();
    const input = container.querySelector("input")!;
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    act(() => zone.focus());
    await user.keyboard("{Enter} ");
    expect(click).toHaveBeenCalledTimes(2);
    rerender(React.createElement(DropZone, { label: "Choose sources", onFiles, renderVisual: visual }));
    expect(zone.querySelector("svg")).toBeNull();
    await user.keyboard("{Enter} ");
    expect(click).toHaveBeenCalledTimes(4);
    rerender(React.createElement(DropZone, { label: "Choose sources", onFiles, renderVisual: visual, disabled: true }));
    fireEvent.keyDown(zone, { key: "Enter" });
    fireEvent.keyDown(zone, { key: " " });
    fireEvent.click(zone);
    expect(click).toHaveBeenCalledTimes(4);
  });

  it("preserves file order, relative paths, skipped feedback and repeat picker selection", async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    const { container } = render(React.createElement(DropZone, { onFiles, renderVisual: visual, allowFolders: true }));
    const first = new File(["one"], "first.txt", { type: "text/plain" });
    Object.defineProperty(first, "webkitRelativePath", { value: "folder/first.txt" });
    const skipped = new File(["unsupported"], "skip.unsupported");
    const second = new File(["two"], "second.md", { type: "text/markdown" });
    const input = container.querySelector("input")!;
    expect(input.hasAttribute("webkitdirectory")).toBe(true);
    await user.upload(input, [first, skipped, second]);
    expect(onFiles).toHaveBeenLastCalledWith([first, second], {
      paths: ["folder/first.txt", "second.md"], skipped: ["skip.unsupported"],
    });
    expect(screen.getAllByText(copy.skippedUnsupported(1))).toHaveLength(2);
    expect(input.value).toBe("");
    await user.upload(input, first);
    expect(onFiles).toHaveBeenCalledTimes(2);
    expect(onFiles).toHaveBeenLastCalledWith([first], { paths: ["folder/first.txt"], skipped: [] });
  });

  it("keeps the visual, spinner and feedback through an asynchronous recursive folder scan", async () => {
    const onFiles = vi.fn();
    render(React.createElement(DropZone, { label: "Choose sources", onFiles, renderVisual: visual, allowFolders: true }));
    const first = new File(["first"], "first.txt");
    const second = new File(["second"], "second.md");
    const skipped = new File(["bad"], "skip.unsupported");
    const fileEntry = (file: File, fullPath: string) => ({
      isFile: true, isDirectory: false, fullPath,
      file: (success: (file: File) => void) => success(file),
    });
    const nestedEntries = [fileEntry(second, "/folder/nested/second.md"), fileEntry(skipped, "/folder/nested/skip.unsupported")];
    const nested = {
      isFile: false, isDirectory: true, fullPath: "/folder/nested",
      createReader: () => {
        let read = false;
        return { readEntries: (success: (entries: unknown[]) => void) => {
          success(read ? [] : nestedEntries);
          read = true;
        } };
      },
    };
    let release!: () => void;
    let batches = 0;
    const directory = {
      isFile: false, isDirectory: true, fullPath: "/folder",
      createReader: () => ({
        readEntries: (success: (entries: unknown[]) => void) => {
          if (batches++ === 0) release = () => success([fileEntry(first, "/folder/first.txt"), nested]);
          else success([]);
        },
      }),
    };
    const zone = screen.getByRole("button", { name: "Choose sources" });
    fireEvent.drop(zone, {
      dataTransfer: { items: [{ kind: "file", webkitGetAsEntry: () => directory }], files: [] },
    });
    expect(screen.getByTestId("manuscript-slot").dataset.busy).toBe("true");
    expect(screen.getByText("Scanning folder…").querySelector("svg")).toBeTruthy();
    expect(onFiles).not.toHaveBeenCalled();
    await act(async () => { release(); });
    expect(onFiles).toHaveBeenCalledOnce();
    expect(onFiles).toHaveBeenCalledWith([first, second], {
      paths: ["folder/first.txt", "folder/nested/second.md"], skipped: ["skip.unsupported"],
    });
    expect(screen.getByTestId("manuscript-slot").dataset.busy).toBe("false");
    expect(screen.queryByText("Scanning folder…")).toBeNull();
    expect(screen.getAllByText(copy.skippedUnsupported(1))).toHaveLength(2);
  });

  it("announces an unsupported-only drop and still reports its metadata", () => {
    const onFiles = vi.fn();
    const { container } = render(React.createElement(DropZone, { label: "Choose sources", onFiles, renderVisual: visual }));
    fireEvent.drop(screen.getByRole("button", { name: "Choose sources" }), {
      dataTransfer: { items: [], files: [new File(["x"], "skip.unsupported")] },
    });
    expect(onFiles).toHaveBeenCalledWith([], { paths: [], skipped: ["skip.unsupported"] });
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(copy.noSupportedFiles);
    expect(screen.getByText(copy.skippedUnsupported(1))).toBeTruthy();
  });
});
