"""ODF (ODT/ODS/ODP) reader backed by odfpy."""

from __future__ import annotations

from pathlib import Path

from ..deps import require
from ..model import Document, Heading, Paragraph, Table
from .base import Reader

ODF_EXTENSIONS = frozenset({".odt", ".ods", ".odp"})


class OdfReader(Reader):
    extensions = ODF_EXTENSIONS
    name = "odf"

    def read(self, input_path: Path) -> Document:
        odf = require("odf", "ODF conversion")  # odfpy
        from odf import teletype, text as odftext
        from odf.opendocument import load

        doc = load(str(input_path))
        result = Document(title=input_path.stem)
        body = doc.body
        # Walk paragraphs and headings in document order.
        for node in body.getElementsByType(odftext.P):
            result.add(Paragraph(teletype.extractText(node)))
        for node in body.getElementsByType(odftext.H):
            level = int(node.getAttribute("outlinelevel") or 1)
            result.add(Heading(text=teletype.extractText(node), level=level))
        return result