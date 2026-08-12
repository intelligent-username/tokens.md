"""Tests for URL fetching."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from src.fetch import fetch_url
from src.registry import UnsupportedFormatError


def test_fetch_url_writes_markdown(tmp_path: Path) -> None:
    with patch("src.fetch.trafilatura.fetch_url", return_value="<html>...</html>"), patch("src.fetch.trafilatura.extract", return_value="# Article\n\nBody text."):
        out = fetch_url("https://example.com/article", tmp_path / "out")

    assert out.exists()
    text = out.read_text(encoding="utf-8")
    assert "example.com" in text
    assert "Body text." in text


def test_fetch_url_failure_raises(tmp_path: Path) -> None:
    with patch("src.fetch.trafilatura.fetch_url", return_value=None), pytest.raises(UnsupportedFormatError):
        fetch_url("https://example.com", tmp_path / "out")
