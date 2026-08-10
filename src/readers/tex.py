"""Best-effort LaTeX reader (regex-based, stdlib only). Preserves math verbatim."""

from __future__ import annotations

import re
from pathlib import Path

from ..model import Document, Heading, Paragraph
from .base import Reader

_SECTION_RE = re.compile(r"\\(?:part|chapter|section|subsection|subsubsection)\*?\{(.+?)\}")
_MATH_DELIMS = ("$$", "$", r"\(", r"\)", r"\[", r"\]", r"\begin{", r"\end{")


class TexReader(Reader):
    extensions = frozenset({".tex"})
    name = "tex"

    def read(self, input_path: Path) -> Document:
        text = input_path.read_text(encoding="utf-8", errors="replace")
        doc = Document(title=input_path.stem)
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("%"):
                continue
            m = _SECTION_RE.search(stripped)
            if m:
                doc.add(Heading(text=m.group(1), level=1))
                continue
            # Math lines pass through untouched; only prose gets cleaned.
            if any(d in stripped for d in _MATH_DELIMS):
                doc.add(Paragraph(stripped))
                continue
            # Strip simple inline commands and braces for readability.
            cleaned = re.sub(r"\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^}]*\})?", "", stripped)
            cleaned = re.sub(r"[{}]", "", cleaned).strip()
            if cleaned:
                doc.add(Paragraph(cleaned))
        return doc