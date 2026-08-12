"""XLSX reader backed by openpyxl. Treats the first non-empty row as the header."""

from __future__ import annotations

from pathlib import Path

from ..deps import require
from ..engine.model import Document, Heading, Table
from .base import Reader


class XlsxReader(Reader):
    extensions = frozenset({".xlsx"})
    name = "xlsx"

    def read(self, input_path: Path) -> Document:
        openpyxl = require("openpyxl", "XLSX conversion")
        wb = openpyxl.load_workbook(str(input_path), data_only=True, read_only=True)
        doc = Document()
        try:
            for ws in wb.worksheets:
                rows: list[list[str]] = []
                for row in ws.iter_rows(values_only=True):
                    values = ["" if v is None else str(v).strip() for v in row]
                    if any(values):
                        rows.append(values)
                if not rows:
                    continue
                doc.add(Table(header=rows[0], rows=rows[1:]))
        finally:
            wb.close()
        return doc