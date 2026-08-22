import { describe, expect, it } from "vitest";
import { extOf, isSupported, SUPPORTED_EXTENSIONS } from "../extensions";

describe("SUPPORTED_EXTENSIONS", () => {
  it("includes primary document formats", () => {
    expect(SUPPORTED_EXTENSIONS).toContain("pdf");
    expect(SUPPORTED_EXTENSIONS).toContain("docx");
    expect(SUPPORTED_EXTENSIONS).toContain("pptx");
    expect(SUPPORTED_EXTENSIONS).toContain("xlsx");
    expect(SUPPORTED_EXTENSIONS).toContain("epub");
    expect(SUPPORTED_EXTENSIONS).toContain("html");
    expect(SUPPORTED_EXTENSIONS).toContain("md");
    expect(SUPPORTED_EXTENSIONS).toContain("txt");
    expect(SUPPORTED_EXTENSIONS).toContain("json");
    expect(SUPPORTED_EXTENSIONS).toContain("csv");
  });

  it("includes code and notebook formats", () => {
    expect(SUPPORTED_EXTENSIONS).toContain("py");
    expect(SUPPORTED_EXTENSIONS).toContain("js");
    expect(SUPPORTED_EXTENSIONS).toContain("ts");
    expect(SUPPORTED_EXTENSIONS).toContain("jsx");
    expect(SUPPORTED_EXTENSIONS).toContain("tsx");
    expect(SUPPORTED_EXTENSIONS).toContain("ipynb");
    expect(SUPPORTED_EXTENSIONS).toContain("tex");
  });
});

describe("extOf", () => {
  it("extracts lowercased extension from standard filename", () => {
    expect(extOf("document.pdf")).toBe("pdf");
    expect(extOf("report.DOCX")).toBe("docx");
    expect(extOf("data.JSON")).toBe("json");
  });

  it("extracts extension from paths with multiple dots", () => {
    expect(extOf("archive.tar.gz")).toBe("gz");
    expect(extOf("my.complex.filename.v2.xlsx")).toBe("xlsx");
  });

  it("returns empty string when there is no dot", () => {
    expect(extOf("README")).toBe("");
    expect(extOf("Dockerfile")).toBe("");
    expect(extOf("")).toBe("");
  });

  it("handles hidden files starting with a dot", () => {
    expect(extOf(".gitignore")).toBe("gitignore");
    expect(extOf(".env.local")).toBe("local");
  });
});

describe("isSupported", () => {
  it("returns true for supported formats", () => {
    expect(isSupported("contract.pdf")).toBe(true);
    expect(isSupported("notes.md")).toBe(true);
    expect(isSupported("data.csv")).toBe(true);
    expect(isSupported("slides.PPTX")).toBe(true);
  });

  it("returns false for unsupported formats", () => {
    expect(isSupported("executable.exe")).toBe(false);
    expect(isSupported("image.png")).toBe(false);
    expect(isSupported("audio.mp3")).toBe(false);
    expect(isSupported("no_extension")).toBe(false);
  });

  it("accepts a custom supported list override", () => {
    const customList = ["custom", "special"] as const;
    expect(isSupported("file.custom", customList)).toBe(true);
    expect(isSupported("file.pdf", customList)).toBe(false);
  });
});
