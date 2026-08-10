"""PPTX reader backed by python-pptx.

Emits a "Slide N" heading per slide, the slide title, body shapes (with
LaTeX-ized OMML equations), and speaker notes.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..deps import require
from ..model import Document, Heading, Paragraph
from ..omml import omath_element_to_latex
from .base import Reader

_DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
_A_T = f"{{{_DRAWING_NS}}}t"
_MATH_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
_M_OMATH = f"{{{_MATH_NS}}}oMath"
_MC_NS = "http://schemas.openxmlformats.org/markup-compatibility/2006"
_MC_ALTERNATE = f"{{{_MC_NS}}}AlternateContent"
_MC_CHOICE = f"{{{_MC_NS}}}Choice"


class PptxReader(Reader):
    """Read .pptx files into a :class:`Document`."""

    extensions = frozenset({".pptx"})
    name = "pptx"

    def read(self, input_path: Path) -> Document:
        pptx = require("pptx", "PPTX conversion")
        prs = pptx.Presentation(str(input_path))
        result = Document(title=input_path.stem)
        for index, slide in enumerate(prs.slides, start=1):
            result.add(Heading(text=f"Slide {index}", level=2))
            title = slide.shapes.title
            if title is not None and title.text.strip():
                result.add(Heading(text=title.text.strip(), level=3))
            for shape in slide.shapes:
                text = _shape_text_with_math(shape)
                if text:
                    result.add(Paragraph(text))
            if slide.has_notes_slide:
                notes_frame = slide.notes_slide.notes_text_frame
                if notes_frame is not None:
                    notes = notes_frame.text.strip()
                    if notes:
                        result.add(Paragraph(f"*Notes:* {notes}"))
        return result


def _shape_text_with_math(shape: Any) -> str:
    """Walk a shape's XML for a:t text and m:oMath equations.

    ``mc:AlternateContent`` is unwrapped to its first ``mc:Choice`` (where
    PowerPoint stores real equations via ``a14:m``). Falls back to
    python-pptx's own ``text_frame.text`` when the XML walk yields nothing.
    """
    parts: list[str] = []

    def walk(node: Any) -> None:
        for child in node:
            if child.tag == _MC_ALTERNATE:
                choice = child.find(_MC_CHOICE)
                if choice is not None:
                    walk(choice)
            elif child.tag == _A_T:
                if child.text:
                    parts.append(child.text)
            elif child.tag == _M_OMATH:
                latex = omath_element_to_latex(child)
                if latex:
                    parts.append(f"$${latex}$$")
            else:
                walk(child)

    walk(shape._element)
    text = "".join(parts).strip()
    if not text and shape.has_text_frame:
        text = shape.text_frame.text.strip()
    return text