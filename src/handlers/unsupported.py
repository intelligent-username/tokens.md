"""Catch-all converter used as the final fallback in the registry."""

from __future__ import annotations

from pathlib import Path

from ..registry import Converter, UnsupportedFormatError


class UnsupportedConverter(Converter):
    """Raises a clear error for any format with no registered handler."""

    extensions = frozenset()
    name = "unsupported"

    def convert(self, input_path: Path, output_dir: Path, **kwargs: object) -> Path:
        from ..registry import DEFAULT_REGISTRY

        exts = ", ".join(sorted(ext.lstrip(".") for ext in DEFAULT_REGISTRY.extensions()))
        ext_label = input_path.suffix.lower() or "<no extension>"
        raise UnsupportedFormatError(
            f"Unsupported format '{ext_label}'. Supported formats: {exts}"
        )