"""Tests for the token budget allocator."""

from __future__ import annotations

from src.budget import BOILERPLATE_PATTERNS, IMAGE_PATTERN, format_prune_report, prune_to_budget


def test_fits_budget_no_change() -> None:
    result = prune_to_budget("short text", budget=1000)
    assert result.fits
    assert result.removed_blocks == []
    assert result.content == "short text"


def test_removes_boilerplate() -> None:
    content = "Copyright 2026 Acme\nAll rights reserved.\nReal content here."
    result = prune_to_budget(content, budget=10)
    assert "Copyright 2026 Acme" not in result.content
    assert "Real content here." in result.content
    assert any("Copyright" in b for b in result.removed_blocks)


def test_removes_image_references() -> None:
    content = "![logo](logo.png)\nReal content here."
    result = prune_to_budget(content, budget=10)
    assert "![logo](logo.png)" not in result.content
    assert "Real content here." in result.content


def test_truncates_from_end() -> None:
    content = "\n".join(f"line {i}" for i in range(50))
    result = prune_to_budget(content, budget=5)
    assert result.fits
    assert result.content != content
    # Earliest content preserved.
    assert "line 0" in result.content


def test_boilerplate_patterns_match() -> None:
    assert BOILERPLATE_PATTERNS[0].match("Copyright 2026")
    assert IMAGE_PATTERN.match("![](img.png)")


def test_format_prune_report() -> None:
    result = prune_to_budget("Copyright 2026\ncontent", budget=1000)
    report = format_prune_report(result, 1000)
    assert "tokens" in report
