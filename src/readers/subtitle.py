"""SRT / VTT subtitle readers (stdlib only)."""

from __future__ import annotations

import re
from pathlib import Path

from ..engine.model import Document, Paragraph
from .base import Reader

_SUBTITLE_EXTENSIONS = frozenset({".srt", ".vtt"})


class SubtitleReader(Reader):
    extensions = _SUBTITLE_EXTENSIONS
    name = "subtitle"

    def read(self, input_path: Path) -> Document:
        text = input_path.read_text(encoding="utf-8", errors="replace")
        doc = Document()
        # Drop cue numbers and timing lines; keep the spoken text.
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or re.match(r"^\d+$", stripped):
                continue
            if "-->" in stripped or stripped.startswith("WEBVTT"):
                continue
            doc.add(Paragraph(stripped))
        return doc