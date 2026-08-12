# src/readers/ipynb.py
"""Jupyter Notebook reader (.ipynb) via stdlib json."""

from __future__ import annotations

import json
from pathlib import Path

from ..engine.model import CodeBlock, Document, Paragraph, RawMarkdown
from .base import Reader


class IpynbReader(Reader):
    extensions = frozenset({".ipynb"})
    name = "ipynb"

    def read(self, input_path: Path) -> Document:
        content = input_path.read_text(encoding="utf-8", errors="replace")
        data = json.loads(content)
        doc = Document()
        cells = data.get("cells", [])
        for cell in cells:
            cell_type = cell.get("cell_type")
            source = "".join(cell.get("source", [])).strip()
            if not source:
                continue
            if cell_type == "markdown":
                doc.add(RawMarkdown(source))
            elif cell_type == "code":
                doc.add(CodeBlock(text=source, language="python"))
                # Extract text outputs if present
                for output in cell.get("outputs", []):
                    if output.get("output_type") == "stream":
                        out_text = "".join(output.get("text", [])).strip()
                        if out_text:
                            doc.add(CodeBlock(text=out_text, language="text"))
                    elif output.get("output_type") in ("execute_result", "display_data"):
                        data_dict = output.get("data", {})
                        text_plain = "".join(data_dict.get("text/plain", [])).strip()
                        if text_plain:
                            doc.add(CodeBlock(text=text_plain, language="text"))
        return doc
