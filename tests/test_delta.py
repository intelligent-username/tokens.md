"""Tests for the delta summary formatting."""

from __future__ import annotations

from pathlib import Path

from src.delta import print_delta_summary


def test_print_delta_summary_single(sample_md: Path, tmp_path: Path, capsys: object) -> None:
    out = tmp_path / "out"
    out.mkdir()
    (out / "notes.md").write_text("# Notes\n\nSome markdown content here.\n", encoding="utf-8")
    print_delta_summary([sample_md], [out / "notes.md"])
    captured = capsys.readouterr()  # type: ignore[attr-defined]
    assert "tokens" in captured.out
    assert "Markdown" in captured.out


def test_print_delta_summary_total_line(tmp_path: Path, capsys: object) -> None:
    a = tmp_path / "a.md"
    b = tmp_path / "b.md"
    a.write_text("AAA\n" * 10, encoding="utf-8")
    b.write_text("BBB\n" * 10, encoding="utf-8")
    out = tmp_path / "out"
    out.mkdir()
    (out / "a.md").write_text("aaa", encoding="utf-8")
    (out / "b.md").write_text("bbb", encoding="utf-8")
    print_delta_summary([a, b], [out / "a.md", out / "b.md"])
    captured = capsys.readouterr()  # type: ignore[attr-defined]
    assert "TOTAL" in captured.out