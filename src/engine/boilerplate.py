"""Cross-page boilerplate detection for paginated Markdown (pymupdf4llm output).

Two removal tiers, both frequency-based over normalized lines:

- Tier 1 (unconditional): bare page numbers, on any document with >= 2 pages,
  corroborated on >= 2 distinct pages.
- Tier 2 (budget-gated via ``full=True``): running headers, footers, and
  watermarks repeated on >= 60% of pages of documents with >= 4 pages.

Single-page documents are never modified.
"""

from __future__ import annotations

import re
from collections import defaultdict

#: pymupdf4llm joins per-page Markdown with this delimiter.
PAGE_DELIMITER = "\n-----\n"

_DIGITS_RE = re.compile(r"\d+")
_WS_RE = re.compile(r"\s+")
_EDGE_NOISE_RE = re.compile(r"^[\s>\-*•·|]+|[\s|*.:]+$")


def _is_page_number_candidate(text: str) -> bool:
    """Return True if line looks like a page number indicator."""
    cleaned = re.sub(r"^(page|pg|p)\b[.:\s]*", "", text, flags=re.IGNORECASE).strip()
    return bool(cleaned and re.fullmatch(r"[\d\s\-/|#.]+", cleaned))


def normalize_line(line: str) -> str:
    """Return the canonical fingerprint key for a line.

    Lowercases, strips markdown edge noise (bullets, quotes, emphasis,
    trailing punctuation), collapses whitespace, and replaces digits
    with ``#`` for page number lines so "Page 12" and "page  13" collide.
    """
    text = _EDGE_NOISE_RE.sub("", line.strip().lower())
    if _is_page_number_candidate(text):
        text = _DIGITS_RE.sub(lambda m: "#" * len(m.group(0)), text)
    return _WS_RE.sub(" ", text)


def _is_page_number(normalized: str) -> bool:
    """Return True for lines that are purely a digit/page placeholder.

    Matches "#", "##", "page #", "- #", and similar; requires at least one "#".
    """
    cleaned = re.sub(r"^(page|pg|p)\b[.:\s]*", "", normalized, flags=re.IGNORECASE).strip()
    return bool("#" in cleaned and set(cleaned) <= {"#", "-", " ", "/", "|", "."})



def find_boilerplate_keys(pages: list[str], *, full: bool, min_full_pages: int = 4, threshold: float = 0.6, max_len: int = 120) -> set[str]:
    """Return the set of normalized-line keys to remove across all pages.

    Tier 1 (page numbers) needs corroboration from >= 2 pages. Tier 2 (full
    furniture) additionally requires ``full=True``, at least ``min_full_pages``
    pages, presence on >= ``threshold`` fraction of pages, and a normalized
    length of at most ``max_len`` characters.
    """
    line_pages: dict[str, set[int]] = defaultdict(set)
    for i, page in enumerate(pages):
        for raw in page.splitlines():
            if raw.strip() and not raw.lstrip().startswith("#"):
                line_pages[normalize_line(raw)].add(i)

    total = len(pages)
    banned = {n for n, pgs in line_pages.items() if _is_page_number(n) and len(pgs) >= 2}

    if full and total >= min_full_pages:
        banned |= {n for n, pgs in line_pages.items() if len(pgs) >= threshold * total and 0 < len(n) <= max_len}
    return banned


def strip_boilerplate(text: str, *, full: bool = False) -> str:
    """Remove fingerprinted boilerplate lines from paginated Markdown.

    Splits ``text`` on the pymupdf4llm page delimiter, fingerprints lines
    across pages, removes banned lines (never inside code fences, never
    headings), and rejoins with the same delimiter. Returns ``text``
    unchanged for single-page input or when detection is unreliable
    (>50% of the document would be removed).
    """
    pages = text.split(PAGE_DELIMITER)
    if len(pages) < 2:
        return text
    banned = find_boilerplate_keys(pages, full=full)
    if not banned:
        return text

    out_pages: list[str] = []
    for page in pages:
        kept: list[str] = []
        in_fence = False
        for line in page.splitlines():
            if line.lstrip().startswith("```"):
                in_fence = not in_fence
                kept.append(line)
                continue
            if in_fence or normalize_line(line) not in banned:
                kept.append(line)
        out_pages.append("\n".join(kept))

    result = PAGE_DELIMITER.join(out_pages)
    if len(result) < len(text) // 2:
        return text
    return result
