"""RTF reader backed by striprtf.

Strips RTF control words and emits the plain text as paragraphs.
"""

from __future__ import annotations

from pathlib import Path

from ..deps import require
from ..model import Document, Paragraph
from .base import Reader


class RtfReader(Reader):
    """Read .rtf files into a :class:`Document`."""

    extensions = frozenset({".rtf"})
    name = "rtf"

    def read(self, input_path: Path) -> Document:
        require("striprtf", "RTF conversion")
        from striprtf.striprtf import rtf_to_text
        raw = input_path.read_text(encoding="utf-8", errors="replace")
        text = rtf_to_text(raw)
        result = Document(title=input_path.stem)
        for line in text.splitlines():
            line = line.strip()
            if line:
                result.add(Paragraph(line))
        return result