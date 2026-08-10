"""Kindle readers: AZW3 (KF8) via the `mobi` package; AZW4 via pymupdf (PDF wrapper)."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

from ..deps import require
from ..model import Document, Heading, Paragraph
from .base import Reader


class Azw3Reader(Reader):
    """AZW3 / KF8 reader. Extracts text and maps the NCX TOC to headings."""

    extensions = frozenset({".azw3"})
    name = "azw3"

    def read(self, input_path: Path) -> Document:
        mobi = require("mobi", "AZW3 conversion")
        # mobi.extract returns a 2-tuple (tempdir, filepath) — there is no third
        # HTML return value. filepath is a single unpacked file whose suffix
        # depends on the source book (HTML, EPUB, or PDF), so branch on it.
        # The caller is responsible for cleaning up tempdir.
        tempdir, filepath = mobi.extract(str(input_path))
        try:
            suffix = Path(filepath).suffix.lower()
            if suffix == ".html":
                raw = Path(filepath).read_text(encoding="utf-8", errors="replace")
                doc = Document(title=input_path.stem)
                # The extracted HTML uses <h1..h6> for chapter headings.
                sections = re.split(r"<h[1-6][^>]*>", raw)
                for i, section in enumerate(sections):
                    text = re.sub(r"<[^>]+>", "", section).strip()
                    if text:
                        doc.add(Heading(text=text, level=1) if i == 0 else Paragraph(text))
                return doc
            if suffix in {".epub", ".pdf"}:
                # Re-route EPUB/PDF wrappers through the existing pymupdf engine.
                from ..handlers.pymupdf import pdf_to_markdown

                doc = Document(title=input_path.stem)
                doc.add(Paragraph(pdf_to_markdown(Path(filepath))))
                return doc
            # Unknown suffix: fall back to reading the unpacked file as plain text.
            doc = Document(title=input_path.stem)
            for line in Path(filepath).read_text(encoding="utf-8", errors="replace").splitlines():
                if line.strip():
                    doc.add(Paragraph(line.strip()))
            return doc
        finally:
            shutil.rmtree(tempdir, ignore_errors=True)


class Azw4Reader(Reader):
    """AZW4 is a PDF wrapper; delegate to the same engine that handles PDFs."""

    extensions = frozenset({".azw4"})
    name = "azw4"

    def read(self, input_path: Path) -> Document:
        from ..handlers.pymupdf import pdf_to_markdown

        markdown = pdf_to_markdown(input_path)
        doc = Document(title=input_path.stem)
        doc.add(Paragraph(markdown))  # pymupdf output is already Markdown
        return doc