"""Primary converter backed by pymupdf4llm.

Handles PDF, e-books, images, and plain text that PyMuPDF can open natively.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..deps import require
from ..registry import Converter, UnsupportedFormatError

#: Formats pymupdf4llm / pymupdf can open natively without extra config.
PYMUPDF_EXTENSIONS = frozenset({".pdf", ".epub", ".mobi", ".xps", ".oxps", ".fb2", ".cbz", ".txt"})


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


def pdf_to_markdown(pdf_path: str | Path, *, strip_headers_footers: bool = False, write_images: bool = False, image_path: str | Path | None = None, pages: list[int] | None = None, **kwargs: Any) -> str:
    """Convert a single file to Markdown and return it as a string.

    This is the string-returning entry point used by ``clip`` and ``watch``.
    """
    pdf_path = Path(pdf_path)
    pymupdf4llm = require("pymupdf4llm", "conversion")

    if write_images and image_path is None:
        import tempfile

        image_path = Path(tempfile.mkdtemp(prefix="tmd_images_"))
    markdown_kwargs = build_markdown_kwargs(strip_headers_footers=strip_headers_footers, write_images=write_images, image_path=image_path, pages=pages, **kwargs)
    result = pymupdf4llm.to_markdown(str(pdf_path), **markdown_kwargs)
    if not isinstance(result, str):
        raise UnsupportedFormatError(f"pymupdf4llm returned non-string output for {pdf_path.name}")
    return result


class PymupdfConverter(Converter):
    """Converts PDF / e-book / image / text files via pymupdf4llm."""

    extensions = PYMUPDF_EXTENSIONS
    name = "pymupdf"

    def convert(self, input_path: Path, output_dir: Path, **kwargs: Any) -> Path:
        pymupdf4llm = require("pymupdf4llm", "conversion")

        output_dir.mkdir(parents=True, exist_ok=True)
        page_chunks = bool(kwargs.pop("page_chunks", False))

        markdown_kwargs = build_markdown_kwargs(output_dir=output_dir, stem=input_path.stem, page_chunks=page_chunks, **kwargs)
        try:
            result = pymupdf4llm.to_markdown(str(input_path), **markdown_kwargs)
        except Exception:
            result = input_path.read_text(encoding="utf-8", errors="replace")

        if isinstance(result, str):
            output_path = output_dir / f"{input_path.stem}.md"
            output_path.write_text(result, encoding="utf-8")
            return output_path

        # page_chunks=True returns a list of per-page strings.
        output_path = output_dir / f"{input_path.stem}_chunks.json"
        output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        return output_path
