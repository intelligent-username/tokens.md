"""Tests for the multi-file merger."""

from __future__ import annotations

from pathlib import Path

from src.merger import build_toc, dedup_lines, merge_files, resolve_to_markdown


def test_merge_files_structure(sample_md: Path, tmp_path: Path) -> None:
    out = tmp_path / "merged.md"
    merge_files([sample_md], out)
    text = out.read_text(encoding="utf-8")
    assert "# merged — Merged Document" in text
    assert "=== FILE: notes.md ===" in text
    assert "Some markdown content here." in text


def test_merge_files_toc(sample_md: Path, tmp_path: Path) -> None:
    out = tmp_path / "merged.md"
    merge_files([sample_md], out)
    text = out.read_text(encoding="utf-8")
    assert "## Table of Contents" in text
    assert "- notes.md" in text


def test_merge_files_no_toc(sample_md: Path, tmp_path: Path) -> None:
    out = tmp_path / "merged.md"
    merge_files([sample_md], out, toc=False)
    assert "## Table of Contents" not in out.read_text(encoding="utf-8")


def test_merge_files_ordering(tmp_path: Path) -> None:
    b = tmp_path / "b.md"
    a = tmp_path / "a.md"
    a.write_text("AAA", encoding="utf-8")
    b.write_text("BBB", encoding="utf-8")
    out = tmp_path / "merged.md"
    merge_files([b, a], out)
    text = out.read_text(encoding="utf-8")
    assert text.index("=== FILE: a.md ===") < text.index("=== FILE: b.md ===")


def test_merge_files_dedup(tmp_path: Path) -> None:
    f = tmp_path / "f.md"
    f.write_text("line1\nline2\nline1\n", encoding="utf-8")
    out = tmp_path / "merged.md"
    merge_files([f], out, dedup=True)
    text = out.read_text(encoding="utf-8")
    assert text.count("line1") == 1


def test_resolve_to_markdown_reads_md(sample_md: Path) -> None:
    assert "Some markdown content here." in resolve_to_markdown(sample_md)


def test_resolve_to_markdown_converts_pdf(sample_pdf: Path) -> None:
    md = resolve_to_markdown(sample_pdf)
    assert "Hello from tokens.md" in md


def test_build_toc() -> None:
    toc = build_toc([("a.md", "# Title\n\n## Section\nbody")])
    assert "- a.md" in toc
    assert "[Title](#title)" in toc
    assert "[Section](#section)" in toc



def test_dedup_lines() -> None:
    assert dedup_lines("x\ny\nx\n") == "x\ny"
