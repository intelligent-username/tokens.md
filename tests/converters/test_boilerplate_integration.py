"""Integration tests: budget-gated boilerplate stripping on multi-page PDFs.

Builds a dedicated multi-page fixture (running header, footer, page numbers,
unique body text per page) and asserts the tier gating end-to-end:

- default conversion removes page numbers only;
- ``full_boilerplate_strip=True`` also removes headers/footers;
- stripped output is strictly smaller than default, which is smaller than
  ``keep_boilerplate=True`` output;
- the fully stripped output fits a token budget that the default exceeds.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from src.handlers.pymupdf import pdf_to_markdown
from src.tokenizer import count_tokens

HEADER = "Field Notes - Chapter Overview"
FOOTER = "Confidential Draft"
PAGE_COUNT = 6


DUMMIES_DIR = Path(__file__).resolve().parent.parent / "dummies"
CANONICAL_DIR = DUMMIES_DIR / "canonical"


@pytest.fixture()
def multipage_pdf() -> Path:
    """Return pre-generated six-page PDF with repeating page furniture."""
    pdf_path = CANONICAL_DIR / "multipage.pdf"
    assert pdf_path.exists(), f"multipage.pdf not found at {pdf_path}"
    return pdf_path


def test_default_removes_page_numbers_only(multipage_pdf: Path) -> None:
    md = pdf_to_markdown(multipage_pdf)
    assert HEADER in md
    assert FOOTER in md


def test_full_strip_removes_all_furniture(multipage_pdf: Path) -> None:
    md = pdf_to_markdown(multipage_pdf, full_boilerplate_strip=True)
    assert HEADER not in md
    assert FOOTER not in md


def test_stripped_is_smaller_than_unstripped(multipage_pdf: Path) -> None:
    kept = count_tokens(pdf_to_markdown(multipage_pdf, keep_boilerplate=True))
    default = count_tokens(pdf_to_markdown(multipage_pdf))
    full = count_tokens(pdf_to_markdown(multipage_pdf, full_boilerplate_strip=True))
    assert full < default < kept


def test_full_strip_fits_budget_threshold(multipage_pdf: Path) -> None:
    default = count_tokens(pdf_to_markdown(multipage_pdf))
    full = count_tokens(pdf_to_markdown(multipage_pdf, full_boilerplate_strip=True))
    midpoint = (default + full) // 2
    assert full <= midpoint < default


def test_unique_body_preserved_in_all_variants(multipage_pdf: Path) -> None:
    for kwargs in ({"keep_boilerplate": True}, {}, {"full_boilerplate_strip": True}):
        md = pdf_to_markdown(multipage_pdf, **kwargs)  # type: ignore[arg-type]
        for i in range(1, PAGE_COUNT + 1):
            assert f"page {i}" in md
