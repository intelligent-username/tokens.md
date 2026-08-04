"""HTML / HTM converter using trafilatura, with a stdlib fallback."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path

from ..deps import require
from ..registry import Converter, UnsupportedFormatError

HTML_EXTENSIONS = frozenset({".html", ".htm"})


class _TextExtractor(HTMLParser):
    """Minimal tag stripper used when trafilatura returns nothing."""

    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self._parts.append(data)

    def text(self) -> str:
        return "\n".join(line.strip() for line in "".join(self._parts).splitlines() if line.strip())


def _strip_tags(html: str) -> str:
    parser = _TextExtractor()
    parser.feed(html)
    return parser.text()


class HtmlConverter(Converter):
    """Converts HTML files to clean Markdown via trafilatura."""

    extensions = HTML_EXTENSIONS
    name = "html"

    def convert(self, input_path: Path, output_dir: Path, **kwargs: object) -> Path:
        trafilatura = require("trafilatura", "HTML conversion")

        output_dir.mkdir(parents=True, exist_ok=True)
        html = input_path.read_text(encoding="utf-8", errors="replace")

        content = trafilatura.extract(html, output_format="markdown")
        if not content:
            content = _strip_tags(html)
        if not content.strip():
            raise UnsupportedFormatError(f"No text could be extracted from {input_path.name}")

        output_path = output_dir / f"{input_path.stem}.md"
        output_path.write_text(content, encoding="utf-8")
        return output_path