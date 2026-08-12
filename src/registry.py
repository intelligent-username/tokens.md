"""
Pluggable converter registry.

Convert class to know file extensions are owned & how to turn a
single input file into a Markdown file on disk. The Registry dispatches
a path to the matching handler, and convert_file is the convenience
entry point used by the pipeline and CLI.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from .detector import FormatDetector


class UnsupportedFormatError(Exception):
    """Raised when no handler can convert a given file."""


class Converter(ABC):
    """Converts a single input file to a Markdown file on disk."""

    #: File extensions this handler owns, lowercase with leading dot, e.g. {".pdf"}.
    extensions: frozenset[str] = frozenset()

    #: Human-readable name for logging / CLI output.
    name: str = ""

    @abstractmethod
    def convert(self, input_path: Path, output_dir: Path, **kwargs: object) -> Path:
        """Convert ``input_path`` and write a .md file into ``output_dir``.

        Return the path of the written file. Raise ``UnsupportedFormatError``
        if the file cannot be converted.
        """


class Registry:
    """Maps file extensions to :class:`Converter` handlers."""

    def __init__(self) -> None:
        self._handlers: dict[str, Converter] = {}
        self._detector = FormatDetector()

    def register(self, converter: Converter) -> None:
        """Register a converter for all of its declared extensions."""
        for ext in converter.extensions:
            self._handlers[ext] = converter

    def get_handler(self, path: Path) -> Converter | None:
        """Return the handler for ``path``'s suffix, or ``None`` if unknown.

        The extension is authoritative; the magic-byte detector only fires as a
        fallback when the extension is unknown (e.g. mislabeled or extensionless
        files).
        """
        ext = path.suffix.lower()
        handler = self._handlers.get(ext)
        if handler is not None:
            return handler
        detected = self._detector.detect(path)
        if detected:
            return self._handlers.get(detected)
        return None

    def extensions(self) -> frozenset[str]:
        """Union of all registered extensions."""
        return frozenset(self._handlers)

    def convert(self, path: Path, output_dir: Path, **kwargs: object) -> Path:
        """Dispatch ``path`` to its handler and convert it.

        Raises :class:`UnsupportedFormatError` if no handler matches.
        """
        handler = self.get_handler(path)
        if handler is None:
            raise UnsupportedFormatError(f"Unsupported format '{path.suffix}'. Supported formats: {', '.join(sorted(ext.lstrip('.') for ext in self.extensions()))}.")
        return handler.convert(path, output_dir, **kwargs)


def convert_file(path: Path, output_dir: Path, registry: Registry | None = None, **kwargs: object) -> Path:
    """Convenience wrapper around ``registry.convert``."""
    if registry is None:
        registry = DEFAULT_REGISTRY
    result = registry.convert(path, output_dir, **kwargs)
    if not isinstance(result, Path):
        raise TypeError(f"Converter returned non-Path result: {result!r}")
    return result


# Populated by src.handlers at import time.
DEFAULT_REGISTRY = Registry()
