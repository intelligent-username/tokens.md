"""Tests for cross-page boilerplate fingerprinting (src.engine.boilerplate)."""

from __future__ import annotations

from src.engine.boilerplate import PAGE_DELIMITER, normalize_line, strip_boilerplate


def _pages(*bodies: str, header: str = "Field Notes — Chapter Overview", footer: str = "Confidential Draft") -> str:
    """Join per-page bodies (each already containing header/footer/number)."""
    return PAGE_DELIMITER.join(bodies)


# --- normalize_line ---------------------------------------------------------


def test_normalize_line_collides_page_variants() -> None:
    assert normalize_line("Page 12") == normalize_line("page  13")
    assert normalize_line("12") == normalize_line("13")


def test_normalize_line_ignores_markdown_noise() -> None:
    assert normalize_line("- **Page 4**") == normalize_line("page 5")
    assert normalize_line("> 42.") == normalize_line("43")


# --- tier 1: page numbers (unconditional on multi-page docs) ----------------


def test_page_numbers_removed_by_default() -> None:
    text = _pages("Alpha body text one\n7", "Beta body text two\n8", "Gamma body text three\n9")
    result = strip_boilerplate(text)
    assert "\n7" not in result and "\n8" not in result and "\n9" not in result
    assert "Alpha body text one" in result


def test_unique_number_line_survives() -> None:
    text = _pages("Alpha body text one\n2024", "Beta body text two\n7", "Gamma body text three\n8")
    result = strip_boilerplate(text)
    assert "2024" in result


def test_single_page_never_touched() -> None:
    text = "Header line\nBody text\n42"
    assert strip_boilerplate(text, full=True) == text


# --- tier 2: full furniture (budget-gated) ----------------------------------


def test_headers_kept_without_full_mode() -> None:
    pages = [f"{hdr}\nUnique body {i}\n{i}" for i, hdr in enumerate(["Running Header"] * 6, start=1)]
    text = PAGE_DELIMITER.join(pages)
    result = strip_boilerplate(text, full=False)
    assert "Running Header" in result
    assert "\n1" not in result  # page numbers still go


def test_headers_removed_with_full_mode() -> None:
    pages = [f"Running Header\nUnique body {i}\n{i}" for i in range(1, 7)]
    text = PAGE_DELIMITER.join(pages)
    result = strip_boilerplate(text, full=True)
    assert "Running Header" not in result
    assert "Unique body 3" in result


def test_full_mode_requires_min_pages() -> None:
    pages = [f"Running Header\nUnique body {i}\n{i}" for i in range(1, 4)]  # 3 pages
    text = PAGE_DELIMITER.join(pages)
    assert "Running Header" in strip_boilerplate(text, full=True)


# --- immunities --------------------------------------------------------------


def test_repeated_heading_survives() -> None:
    pages = [f"# Overview\nUnique body {i}\n{i}" for i in range(1, 7)]
    text = PAGE_DELIMITER.join(pages)
    result = strip_boilerplate(text, full=True)
    assert "# Overview" in result


def test_code_fence_lines_survive() -> None:
    pages = [f"```\nrepeated line\n```\nUnique body {i}\n{i}" for i in range(1, 7)]
    text = PAGE_DELIMITER.join(pages)
    result = strip_boilerplate(text, full=True)
    assert "repeated line" in result


# --- abort guard --------------------------------------------------------------


def test_abort_guard_when_majority_repeats() -> None:
    pages = [f"Running Header\nShared paragraph text\nUnique {i}\n{i}" for i in range(1, 7)]
    text = PAGE_DELIMITER.join(pages)
    assert strip_boilerplate(text, full=True) == text
