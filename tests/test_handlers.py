"""Tests for the built-in converter handlers."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.registry import DEFAULT_REGISTRY, UnsupportedFormatError


def _convert(sample: Path, tmp_path: Path) -> Path:
    return DEFAULT_REGISTRY.convert(sample, tmp_path / "out")


def test_pymupdf_converts_pdf(sample_pdf: Path, tmp_path: Path) -> None:
    out = _convert(sample_pdf, tmp_path)
    assert out.suffix == ".md"
    assert "Hello from tokens.md" in out.read_text(encoding="utf-8")


def test_office_converts_docx(sample_docx: Path, tmp_path: Path) -> None:
    out = _convert(sample_docx, tmp_path)
    text = out.read_text(encoding="utf-8")
    assert "Dear friend" in text
    assert "This is a letter." in text


def test_structured_converts_csv(sample_csv: Path, tmp_path: Path) -> None:
    out = _convert(sample_csv, tmp_path)
    text = out.read_text(encoding="utf-8")
    assert "| name | age |" in text
    assert "alice" in text


def test_structured_converts_json(sample_json: Path, tmp_path: Path) -> None:
    out = _convert(sample_json, tmp_path)
    text = out.read_text(encoding="utf-8")
    assert "```json" in text
    assert "localhost" in text


def test_structured_bad_json_raises(tmp_path: Path) -> None:
    bad = tmp_path / "bad.json"
    bad.write_text("{not json", encoding="utf-8")
    with pytest.raises(UnsupportedFormatError):
        _convert(bad, tmp_path)


def test_pymupdf_converts_txt(sample_txt: Path, tmp_path: Path) -> None:
    out = _convert(sample_txt, tmp_path)
    assert "Plain text content." in out.read_text(encoding="utf-8")


def test_unknown_format_raises(tmp_path: Path) -> None:
    unknown = tmp_path / "blob.xyz"
    unknown.write_text("data", encoding="utf-8")
    with pytest.raises(UnsupportedFormatError) as excinfo:
        _convert(unknown, tmp_path)
    assert "Unsupported format '.xyz'" in str(excinfo.value)