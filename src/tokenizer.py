"""
tiktoken wrapper for token counting
"""

from __future__ import annotations

from functools import cache, lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, cast

from .deps import require

if TYPE_CHECKING:
    import tiktoken

DEFAULT_ENCODING = "o200k_base"


@cache
def get_encoding(name: str = DEFAULT_ENCODING) -> tiktoken.Encoding:
    """Return a cached tiktoken encoding."""
    tiktoken_mod = require("tiktoken", "token counting")

    return cast("tiktoken.Encoding", tiktoken_mod.get_encoding(name))


@lru_cache(maxsize=8192)
def count_tokens(text: str, encoding: str = DEFAULT_ENCODING) -> int:
    """Count the number of tokens in ``text``."""
    return len(get_encoding(encoding).encode(text))


def count_tokens_in_file(path: Path, encoding: str = DEFAULT_ENCODING) -> int:
    """Count tokens in a UTF-8 text file."""
    text = path.read_text(encoding="utf-8", errors="replace")
    return count_tokens(text, encoding)


def count_raw_file_tokens(path: Path, encoding: str = DEFAULT_ENCODING) -> int:
    """Estimate the token count of a whole file from its raw size.

    Uses the common ~4 bytes-per-token heuristic so the estimate reflects the
    entire binary file (PDF/DOCX/PPTX/etc.) rather than just its extracted
    text. Returns ``0`` if the file cannot be stat'd.
    """
    try:
        size = path.stat().st_size
    except OSError:
        return 0
    return max(1, size // 4)


def count_pdf_tokens(path: Path, encoding: str = DEFAULT_ENCODING) -> int:
    """Count tokens in a PDF by extracting its text via pymupdf."""
    pymupdf = require("pymupdf", "PDF token counting")

    with pymupdf.open(str(path)) as doc:
        text = "\n".join(str(page.get_text()) for page in doc)
    return count_tokens(text, encoding)


def format_tokens(n: int) -> str:
    """Format a token count with thousands separators, e.g. ``142,000``."""
    return f"{n:,}"


def delta_percent(source: int, target: int) -> float:
    """Return the percent change from ``source`` to ``target``.

    ``(target - source) / source * 100``. Returns ``0.0`` when ``source`` is 0.
    """
    if source == 0:
        return 0.0
    return (target - source) / source * 100
