"""Best-effort Office converter for DOCX / PPTX / XLSX using stdlib only.

These formats are ZIP/XML containers; we extract the visible text without any
formatting fidelity. On any parsing failure an ``UnsupportedFormatError`` is
raised so the caller can report a clear reason instead of silently skipping.
"""

from __future__ import annotations

import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from ..registry import Converter, UnsupportedFormatError

OFFICE_EXTENSIONS = frozenset({".docx", ".pptx", ".xlsx"})

_WORD_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
_PPT_NS = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
_SPREADSHEET_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

_WS = re.compile(r"\s+")


def _collapse(text: str) -> str:
    """Collapse runs of whitespace into a single space."""
    return _WS.sub(" ", text).strip()


def _read_docx(zf: zipfile.ZipFile) -> str:
    root = ET.fromstring(zf.read("word/document.xml"))
    paragraphs: list[str] = []
    for para in root.iter(f"{_WORD_NS}p"):
        texts = [
            t.text or ""
            for t in para.iter(f"{_WORD_NS}t")
        ]
        line = _collapse("".join(texts))
        if line:
            paragraphs.append(line)
    return "\n".join(paragraphs)


def _read_pptx(zf: zipfile.ZipFile) -> str:
    slide_names = sorted(
        (n for n in zf.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
        key=lambda n: int(re.search(r"(\d+)", n).group(1)),  # type: ignore[union-attr]
    )
    slides: list[str] = []
    for index, name in enumerate(slide_names, start=1):
        root = ET.fromstring(zf.read(name))
        texts = [t.text or "" for t in root.iter(f"{_PPT_NS}t")]
        lines = [line for line in (_collapse(t) for t in texts) if line]
        slides.append(f"## Slide {index}\n" + "\n".join(lines))
    return "\n\n".join(slides)


def _read_xlsx(zf: zipfile.ZipFile) -> str:
    shared: list[str] = []
    if "xl/sharedStrings.xml" in zf.namelist():
        sst = ET.fromstring(zf.read("xl/sharedStrings.xml"))
        for si in sst.iter(f"{_SPREADSHEET_NS}si"):
            shared.append(_collapse("".join(t.text or "" for t in si.iter(f"{_SPREADSHEET_NS}t"))))

    sheet_names = sorted(
        (n for n in zf.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)),
        key=lambda n: int(re.search(r"(\d+)", n).group(1)),  # type: ignore[union-attr]
    )
    tables: list[str] = []
    for name in sheet_names:
        root = ET.fromstring(zf.read(name))
        rows: list[list[str]] = []
        for row in root.iter(f"{_SPREADSHEET_NS}row"):
            cells: list[str] = []
            for cell in row.iter(f"{_SPREADSHEET_NS}c"):
                ref = cell.attrib.get("t")
                value = cell.find(f"{_SPREADSHEET_NS}v")
                text = ""
                if value is not None and value.text is not None:
                    text = value.text
                    if ref == "s":
                        try:
                            text = shared[int(text)]
                        except (ValueError, IndexError):
                            text = ""
                cells.append(_collapse(text))
            rows.append(cells)
        header = rows[0] if rows else []
        lines = ["| " + " | ".join(header) + " |", "|" + "|".join("---" for _ in header) + "|"]
        for row in rows[1:]:
            lines.append("| " + " | ".join(row) + " |")
        tables.append("\n".join(lines))
    return "\n\n".join(tables)


class OfficeConverter(Converter):
    """Best-effort text extraction for Office Open XML files."""

    extensions = OFFICE_EXTENSIONS
    name = "office"

    def convert(self, input_path: Path, output_dir: Path, **kwargs: object) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        try:
            if input_path.suffix.lower() == ".docx":
                with zipfile.ZipFile(input_path) as zf:
                    content = _read_docx(zf)
            elif input_path.suffix.lower() == ".pptx":
                with zipfile.ZipFile(input_path) as zf:
                    content = _read_pptx(zf)
            elif input_path.suffix.lower() == ".xlsx":
                with zipfile.ZipFile(input_path) as zf:
                    content = _read_xlsx(zf)
            else:  # pragma: no cover - registry guarantees the extension
                raise UnsupportedFormatError(f"Unsupported office format {input_path.suffix}")
        except (zipfile.BadZipFile, KeyError, ET.ParseError, ValueError) as exc:
            raise UnsupportedFormatError(
                f"Could not parse {input_path.name}: {exc}"
            ) from exc

        # Guard against accidentally-empty extractions.
        if not content.strip():
            raise UnsupportedFormatError(
                f"No text could be extracted from {input_path.name}"
            )

        output_path = output_dir / f"{input_path.stem}.md"
        output_path.write_text(content, encoding="utf-8")
        return output_path