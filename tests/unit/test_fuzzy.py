"""Tests for simhash fuzzy matching and the budget cascade collapse pass."""

from __future__ import annotations

from src.budget import prune_to_budget
from src.budget_support.fuzzy import hamming, is_immutable_block, simhash
from src.budget_support.passes import _pass1_collapse_duplicates

PARAGRAPH_A = "The quick brown fox jumps over the lazy dog near the river bank every morning."
PARAGRAPH_A_VARIANT = "The quick brown fox leaps over the lazy dog near the river bank every morning."
PARAGRAPH_B = "Solar panels convert sunlight into electricity through photovoltaic cells made of silicon."


# --- simhash primitives ------------------------------------------------------


def test_simhash_stable_under_small_edits() -> None:
    assert hamming(simhash(PARAGRAPH_A), simhash(PARAGRAPH_A_VARIANT)) <= 6


def test_simhash_far_for_unrelated_texts() -> None:
    assert hamming(simhash(PARAGRAPH_A), simhash(PARAGRAPH_B)) > 6


def test_is_immutable_block() -> None:
    assert is_immutable_block("## Some Heading")
    assert is_immutable_block("=== FILE: notes.md ===")
    assert is_immutable_block("- [Overview](#overview)\n- [Install](#install)")
    assert is_immutable_block("")
    assert not is_immutable_block(PARAGRAPH_A)


# --- collapse pass -----------------------------------------------------------


def test_identical_paragraph_collapsed() -> None:
    content = f"Intro heading\n\n{PARAGRAPH_A}\n\n{PARAGRAPH_A}"
    removed: list[str] = []
    result = _pass1_collapse_duplicates(content, removed, "o200k_base")
    assert result.count("(repeated from §1)") == 1
    assert len(removed) == 1


def test_near_duplicate_collapsed_distinct_kept() -> None:
    content = f"{PARAGRAPH_A}\n\n{PARAGRAPH_A_VARIANT}\n\n{PARAGRAPH_B}"
    removed: list[str] = []
    result = _pass1_collapse_duplicates(content, removed, "o200k_base")
    assert "(repeated from §1)" in result
    assert PARAGRAPH_B in result
    assert len(removed) == 1


def test_headings_and_separators_immune() -> None:
    content = f"## Notes\n\n{PARAGRAPH_A}\n\n=== FILE: a.md ===\n\n{PARAGRAPH_A}"
    removed: list[str] = []
    result = _pass1_collapse_duplicates(content, removed, "o200k_base")
    assert "## Notes" in result
    assert "=== FILE: a.md ===" in result
    assert "(repeated from §1)" in result


def test_short_blocks_immune() -> None:
    content = f"tiny block\n\n{PARAGRAPH_A}\n\ntiny block"
    removed: list[str] = []
    result = _pass1_collapse_duplicates(content, removed, "o200k_base")
    assert result.count("tiny block") == 2


def test_marker_ordinals_with_multiple_sources() -> None:
    content = f"{PARAGRAPH_A}\n\n{PARAGRAPH_B}\n\n{PARAGRAPH_A}\n\n{PARAGRAPH_B}"
    removed: list[str] = []
    result = _pass1_collapse_duplicates(content, removed, "o200k_base")
    assert "(repeated from §1)" in result
    assert "(repeated from §2)" in result
    assert len(removed) == 2


# --- cascade integration -----------------------------------------------------


def test_prune_to_budget_collapses_duplicates() -> None:
    content = f"{PARAGRAPH_A}\n\n{PARAGRAPH_A}\n\n{PARAGRAPH_A}"
    result = prune_to_budget(content, budget=10_000)
    assert result.content.count("(repeated from §1)") == 2
    assert PARAGRAPH_A in result.content
    assert any("duplicate of §1" in block for block in result.removed_blocks)
