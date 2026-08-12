"""Native Markdown reader (.md, .markdown, .mdx)."""

from __future__ import annotations

from pathlib import Path

from ..engine.model import Document, RawMarkdown
from .base import Reader


class MarkdownReader(Reader):
    extensions = frozenset({".md", ".markdown", ".mdx"})
    name = "markdown"

    def read(self, input_path: Path) -> Document:
        text = input_path.read_text(encoding="utf-8", errors="replace")
        doc = Document()
        doc.add(RawMarkdown(text))
        return doc
