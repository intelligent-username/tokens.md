"""Abstract Reader interface: turns one input file into a :class:`Document`."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from ..engine.model import Document


class Reader(ABC):
    """Reads a single input file and returns a structured :class:`Document`.

    Implementations must be pure-Python and self-contained (no external CLIs,
    no network calls). They should raise ``UnsupportedFormatError`` with a clear
    message when the file cannot be read (e.g. DRM, corruption).
    """

    #: File extensions this reader owns, lowercase with leading dot.
    extensions: frozenset[str] = frozenset()

    #: Human-readable name for logging.
    name: str = ""

    @abstractmethod
    def read(self, input_path: Path) -> Document:
        """Parse ``input_path`` and return a :class:`Document`."""
