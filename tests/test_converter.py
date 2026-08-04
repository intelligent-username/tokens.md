"""Tests for the backward-compatible converter API."""

from __future__ import annotations

from pathlib import Path

from src.converter import convert_pdf_to_markdown, pdf_to_markdown, run_pipeline


def test_pdf_to_markdown_returns_string(sample_pdf: Path) -> None:
    md = pdf_to_markdown(sample_pdf)
    assert isinstance(md, str)
    assert "Hello from tokens.md" in md


def test_convert_pdf_writes_file(sample_pdf: Path, tmp_output: Path) -> None:
    out = convert_pdf_to_markdown(sample_pdf, output_dir=tmp_output)
    assert out.exists()
    assert out.read_text(encoding="utf-8").startswith("Hello from tokens.md")


def test_run_pipeline_directory(tmp_path: Path, sample_pdf: Path) -> None:
    in_dir = tmp_path / "in"
    in_dir.mkdir()
    pdf = in_dir / sample_pdf.name
    sample_pdf.rename(pdf)
    results = run_pipeline(in_dir, output_dir=tmp_path / "out")
    assert len(results) == 1
    assert results[0].exists()


def test_run_pipeline_respects_extensions(tmp_path: Path, sample_txt: Path) -> None:
    in_dir = tmp_path / "in"
    in_dir.mkdir()
    txt = in_dir / sample_txt.name
    sample_txt.rename(txt)
    results = run_pipeline(in_dir, output_dir=tmp_path / "out", extensions=(".md",))
    assert results == []