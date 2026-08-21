"""Backward-compatible Office converter delegating to the dedicated readers."""

from __future__ import annotations

from pathlib import Path

from ..readers.docx import DocxReader
from ..readers.pptx import PptxReader
from ..readers.xlsx import XlsxReader
from ..registry import Converter, UnsupportedFormatError

_READERS = {".docx": DocxReader(), ".pptx": PptxReader(), ".xlsx": XlsxReader()}


class OfficeConverter(Converter):
    """Thin facade over DocxReader / PptxReader / XlsxReader."""

    extensions = frozenset(_READERS)
    name = "office"

    def convert(self, input_path: Path, output_dir: Path, **kwargs: object) -> Path:
        reader = _READERS.get(input_path.suffix.lower())
        if reader is None:
            raise UnsupportedFormatError(f"Unsupported office format {input_path.suffix}")
        output_dir.mkdir(parents=True, exist_ok=True)
        document = reader.read(input_path)
        from ..engine.renderer import MarkdownRenderer

        markdown = MarkdownRenderer().render(document)
        out = output_dir / f"{input_path.stem}.md"
        out.write_text(markdown, encoding="utf-8")
        return out
