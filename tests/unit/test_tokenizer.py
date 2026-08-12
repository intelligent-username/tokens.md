"""Tests for the shared tokenizer utilities."""

from __future__ import annotations

from pathlib import Path

from src.tokenizer import (
    count_pdf_tokens,
    count_tokens,
    count_tokens_in_file,
    delta_percent,
    format_tokens,
    get_encoding,
)


def test_count_tokens_basic() -> None:
    assert count_tokens("hello world") > 0


def test_count_tokens_encoding_override() -> None:
    a = count_tokens("hello world", encoding="o200k_base")
    b = count_tokens("hello world", encoding="cl100k_base")
    assert a > 0
    assert b > 0


def test_get_encoding_is_cached() -> None:
    assert get_encoding("o200k_base") is get_encoding("o200k_base")


def test_count_tokens_in_file(sample_txt: Path) -> None:
    assert count_tokens_in_file(sample_txt) > 0


def test_count_pdf_tokens(sample_pdf: Path) -> None:
    assert count_pdf_tokens(sample_pdf) > 0


def test_format_tokens() -> None:
    assert format_tokens(142000) == "142,000"
    assert format_tokens(0) == "0"


def test_delta_percent() -> None:
    assert delta_percent(100, 50) == -50.0
    assert delta_percent(100, 200) == 100.0
    assert delta_percent(0, 10) == 0.0
