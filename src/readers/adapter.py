"""Adapter that turns a :class:`Reader` + :class:`MarkdownRenderer` into a :class:`Converter`."""

from __future__ import annotations

from pathlib import Path

from ..engine.model import Document
from ..engine.renderer import MarkdownRenderer
from ..registry import Converter, UnsupportedFormatError
from .base import Reader


class ReaderConverter(Converter):
    """A :class:`Converter` backed by a :class:`Reader` and a :class:`MarkdownRenderer`.

    This is the Dependency-Inversion seam: the orchestration depends on the
    ``Reader`` and ``MarkdownRenderer`` abstractions, never on concrete libraries.
    """

    def __init__(self, reader: Reader, renderer: MarkdownRenderer | None = None) -> None:
        self._reader = reader
        self._renderer = renderer or MarkdownRenderer()
        self.extensions = reader.extensions
        self.name = reader.name

    def convert(self, input_path: Path, output_dir: Path, **kwargs: object) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        try:
            document: Document = self._reader.read(input_path)
        except UnsupportedFormatError:
            raise
        except Exception as exc:  # any parser/library error -> friendly failure
            raise UnsupportedFormatError(
                f"Could not convert {input_path.name}: {exc}"
            ) from exc
        if not document.blocks:
            raise UnsupportedFormatError(
                f"No content could be extracted from {input_path.name}"
            )
        markdown = self._renderer.render(document)
        output_path = output_dir / f"{input_path.stem}.md"
        output_path.write_text(markdown, encoding="utf-8")
        return output_path