"""Primary converter backed by pymupdf4llm, with a vanilla-pymupdf fallback.

Handles PDF, e-books, images, and plain text that PyMuPDF can open natively.
On platforms where pymupdf4llm cannot be installed (currently Windows ARM64,
because its pinned ``pymupdf-layout`` C-extension ships no ``win_arm64``
wheel), conversion falls back to a bare-bones vanilla-pymupdf extractor.
"""

from __future__ import annotations

import json
from pathlib import Path
from types import ModuleType
from typing import Any, cast

from ..deps import MissingDependencyError, require
from ..engine.boilerplate import PAGE_DELIMITER, strip_boilerplate
from ..registry import Converter, UnsupportedFormatError

#: Formats pymupdf4llm / pymupdf can open natively without extra config.
PYMUPDF_EXTENSIONS = frozenset({".pdf", ".epub", ".mobi", ".xps", ".oxps", ".fb2", ".cbz", ".txt"})


def _load_pymupdf4llm() -> ModuleType | None:
    """Return the ``pymupdf4llm`` module, or ``None`` if it is not installed.

    pymupdf4llm is unavailable on platforms where its pinned C-extension
    ``pymupdf-layout`` has no wheel (currently Windows ARM64). Callers fall
    back to :func:`_pdf_to_markdown_fallback` in that case.
    """
    try:
        return cast(ModuleType, require("pymupdf4llm", "conversion"))
    except MissingDependencyError:
        return None


def build_markdown_kwargs(*, strip_headers_footers: bool = False, page_chunks: bool = False, write_images: bool = False, image_path: str | Path | None = None, pages: list[int] | None = None, output_dir: Path | None = None, stem: str = "", **kwargs: Any) -> dict[str, Any]:
    """Build the keyword arguments forwarded to ``pymupdf4llm.to_markdown``."""
    markdown_kwargs: dict[str, Any] = {"header": not strip_headers_footers, "footer": not strip_headers_footers, "page_chunks": page_chunks, "write_images": write_images, **kwargs}

    if pages is not None:
        markdown_kwargs["pages"] = pages

    if write_images:
        if image_path is None:
            if output_dir is None or not stem:
                raise ValueError("image_path required when output_dir/stem unavailable")
            image_path = output_dir / f"{stem}_images"
        else:
            image_path = Path(image_path)
        image_path.mkdir(parents=True, exist_ok=True)
        markdown_kwargs["image_path"] = str(image_path)

    return markdown_kwargs


def pdf_to_markdown(pdf_path: str | Path, *, strip_headers_footers: bool = False, keep_boilerplate: bool = False, full_boilerplate_strip: bool = False, write_images: bool = False, image_path: str | Path | None = None, pages: list[int] | None = None, **kwargs: Any) -> str:
    """Convert a single file to Markdown and return it as a string.

    This is the string-returning entry point used by ``clip`` and ``watch``.
    Uses pymupdf4llm when available; falls back to vanilla pymupdf otherwise.
    Unless ``keep_boilerplate`` is set, repeated page numbers are always
    removed and, when ``full_boilerplate_strip`` is set, repeated running
    headers/footers/watermarks are removed as well.
    """
    pdf_path = Path(pdf_path)
    pymupdf4llm = _load_pymupdf4llm()
    if pymupdf4llm is None:
        result = _pdf_to_markdown_fallback(pdf_path)
        if not keep_boilerplate:
            result = strip_boilerplate(result, full=full_boilerplate_strip)
        return result

    if write_images and image_path is None:
        import tempfile

        image_path = Path(tempfile.mkdtemp(prefix="tmd_images_"))
    markdown_kwargs = build_markdown_kwargs(strip_headers_footers=strip_headers_footers, write_images=write_images, image_path=image_path, pages=pages, **kwargs)
    result = pymupdf4llm.to_markdown(str(pdf_path), **markdown_kwargs)
    if isinstance(result, str) and not keep_boilerplate:
        result = strip_boilerplate(result, full=full_boilerplate_strip)
    if not isinstance(result, str):
        raise UnsupportedFormatError(f"pymupdf4llm returned non-string output for {pdf_path.name}")
    return result


class PymupdfConverter(Converter):
    """Converts PDF / e-book / image / text files via pymupdf4llm."""

    extensions = PYMUPDF_EXTENSIONS
    name = "pymupdf"

    def convert(self, input_path: Path, output_dir: Path, **kwargs: Any) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        page_chunks = bool(kwargs.pop("page_chunks", False))
        keep_boilerplate = bool(kwargs.pop("keep_boilerplate", False))
        full_boilerplate_strip = bool(kwargs.pop("full_boilerplate_strip", False))

        pymupdf4llm = _load_pymupdf4llm()
        if pymupdf4llm is None:
            try:
                result = _pdf_to_markdown_fallback(input_path)
            except Exception:
                result = input_path.read_text(encoding="utf-8", errors="replace")
            if not keep_boilerplate:
                result = strip_boilerplate(result, full=full_boilerplate_strip)
            output_path = output_dir / f"{input_path.stem}.md"
            output_path.write_text(result, encoding="utf-8")
            return output_path

        markdown_kwargs = build_markdown_kwargs(output_dir=output_dir, stem=input_path.stem, page_chunks=page_chunks, **kwargs)
        try:
            result = pymupdf4llm.to_markdown(str(input_path), **markdown_kwargs)
        except Exception:
            result = input_path.read_text(encoding="utf-8", errors="replace")

        if isinstance(result, str):
            if not keep_boilerplate:
                result = strip_boilerplate(result, full=full_boilerplate_strip)
            output_path = output_dir / f"{input_path.stem}.md"
            output_path.write_text(result, encoding="utf-8")
            return output_path

        # page_chunks=True returns a list of per-page strings.
        output_path = output_dir / f"{input_path.stem}_chunks.json"
        output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        return output_path


def _pdf_to_markdown_fallback(pdf_path: str | Path) -> str:
    """Bare-bones vanilla-pymupdf converter for platforms without pymupdf4llm.

    Used when pymupdf4llm cannot be installed (currently Windows ARM64, until
    ``pymupdf-layout`` ships a ``win_arm64`` wheel). Headings via font-size
    heuristic; no layout analysis, no table detection, no OCR.
    """
    pymupdf = require("pymupdf", "conversion")
    pages: list[str] = []
    with pymupdf.open(str(pdf_path)) as doc:
        for page in doc:
            lines: list[str] = []
            blocks = page.get_text("dict")["blocks"]
            sizes = [span["size"] for block in blocks for line in block.get("lines", []) for span in line["spans"]]
            body_size = max(set(sizes), key=sizes.count) if sizes else 10.0
            for block in blocks:
                for line in block.get("lines", []):
                    text = "".join(span["text"] for span in line["spans"]).strip()
                    if not text:
                        continue
                    size = line["spans"][0]["size"]
                    if size > body_size * 1.4:
                        lines.append(f"# {text}")
                    elif size > body_size * 1.15:
                        lines.append(f"## {text}")
                    else:
                        lines.append(text)
            pages.append("\n".join(lines))
    return PAGE_DELIMITER.join(pages)
