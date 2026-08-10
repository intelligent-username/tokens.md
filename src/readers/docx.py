"""DOCX reader backed by python-docx.

Emits headings, paragraphs, lists, tables, code blocks, and LaTeX-ized OMML
equations.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..deps import require
from ..model import CodeBlock, Document, Heading, Paragraph, Quote, Table
from ..omml import omath_element_to_latex
from .base import Reader

_W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
_W_R = f"{{{_W_NS}}}r"
_W_T = f"{{{_W_NS}}}t"
_M_OMATH = f"{{{_M_NS}}}oMath"
_M_OMATH_PARA = f"{{{_M_NS}}}oMathPara"


class DocxReader(Reader):
    """Read .docx files into a :class:`Document`."""

    extensions = frozenset({".docx"})
    name = "docx"

    def read(self, input_path: Path) -> Document:
        docx = require("docx", "DOCX conversion")
        document = docx.Document(str(input_path))
        result = Document(title=input_path.stem)
        for paragraph in document.paragraphs:
            style = (paragraph.style.name or "").lower() if paragraph.style else ""
            text = _paragraph_text_with_math(paragraph)
            if not text:
                continue
            if style.startswith("heading"):
                try:
                    level = int(style.split()[-1])
                except ValueError:
                    level = 1
                result.add(Heading(text=text, level=min(max(level, 1), 6)))
            elif style == "title":
                result.add(Heading(text=text, level=1))
            elif style in ("code", "source code"):
                result.add(CodeBlock(text=text))
            elif style == "quote":
                result.add(Quote(text=text))
            else:
                result.add(Paragraph(text=text))
        for table in document.tables:
            result.add(_table_from_docx(table))
        return result


def _paragraph_text_with_math(paragraph: Any) -> str:
    """Concatenate run text and OMML equations inside a paragraph.

    Inline ``m:oMath`` becomes ``$…$``; display ``m:oMathPara`` becomes ``$$…$$``.
    """
    parts: list[str] = []
    for child in paragraph._p:
        if child.tag in (_M_OMATH, _M_OMATH_PARA):
            latex = omath_element_to_latex(child)
            if latex:
                delim = "$$" if child.tag == _M_OMATH_PARA else "$"
                parts.append(f"{delim}{latex}{delim}")
        elif child.tag == _W_R:
            text = "".join(t.text or "" for t in child.iter(_W_T))
            if text:
                parts.append(text)
    return "".join(parts).strip()


def _table_from_docx(table: Any) -> Table:
    """Convert a python-docx table into a :class:`Table`."""
    header: list[str] = []
    rows: list[list[str]] = []
    for row_index, row in enumerate(table.rows):
        cells = [cell.text.strip() for cell in row.cells]
        if row_index == 0:
            header = cells
        else:
            rows.append(cells)
    return Table(header=header, rows=rows)