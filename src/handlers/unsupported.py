"""Catch-all converter used as the final fallback in the registry."""

from __future__ import annotations

from pathlib import Path

from ..registry import Converter, UnsupportedFormatError


class UnsupportedConverter(Converter):
    """Raises a clear error for any format with no registered handler."""

    extensions = frozenset()
    name = "unsupported"

    def convert(self, input_path: Path, output_dir: Path, **kwargs: object) -> Path:
        raise UnsupportedFormatError(
            f"Unsupported format '{input_path.suffix}'. Supported formats: "
            f"pdf, epub, mobi, xps, docx, pptx, xlsx, html, json, xml, csv, txt, ..."
        )