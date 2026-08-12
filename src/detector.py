"""Magic-byte format detection, used as a fallback when the extension is unknown."""

from __future__ import annotations

from pathlib import Path

#: Map of magic-byte prefixes to canonical extensions.
_MAGIC: list[tuple[bytes, str]] = [
    (b"%PDF-", ".pdf"),
    (b"PK\x03\x04", ".zip"),  # also DOCX/PPTX/XLSX/EPUB (ZIP containers)
    (b"{\\rtf", ".rtf"),
    (b"Rar!", ".rar"),
    (b"\x1f\x8b", ".gz"),
    (b"7z\xbc\xaf\x27\x1c", ".7z"),
]


class FormatDetector:
    """Infers a file's format from its leading bytes when the extension is unknown."""

    def detect(self, path: Path) -> str | None:
        """Return a canonical extension (with dot) or ``None`` if unknown."""
        try:
            with path.open("rb") as handle:
                head = handle.read(16)
        except OSError:
            return None
        for magic, ext in _MAGIC:
            if head.startswith(magic):
                return ext
        return None
