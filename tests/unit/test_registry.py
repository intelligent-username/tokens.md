"""Tests for the converter registry."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.registry import Converter, Registry, UnsupportedFormatError, convert_file


class _FakeConverter(Converter):
    extensions = frozenset({".fake"})
    name = "fake"

    def convert(self, input_path: Path, output_dir: Path, **kwargs: object) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        out = output_dir / f"{input_path.stem}.md"
        out.write_text("fake content", encoding="utf-8")
        return out


def test_registry_dispatch(tmp_path: Path) -> None:
    registry = Registry()
    registry.register(_FakeConverter())
    src = tmp_path / "x.fake"
    src.write_text("data", encoding="utf-8")
    out = registry.convert(src, tmp_path / "out")
    assert out.read_text(encoding="utf-8") == "fake content"


def test_registry_unknown_format_raises(tmp_path: Path) -> None:
    registry = Registry()
    src = tmp_path / "x.xyz"
    src.write_text("data", encoding="utf-8")
    with pytest.raises(UnsupportedFormatError):
        registry.convert(src, tmp_path / "out")


def test_registry_extensions_union() -> None:
    registry = Registry()
    registry.register(_FakeConverter())
    assert ".fake" in registry.extensions()


def test_convert_file_uses_default_registry(tmp_path: Path) -> None:
    src = tmp_path / "x.xyz"
    src.write_text("data", encoding="utf-8")
    with pytest.raises(UnsupportedFormatError):
        convert_file(src, tmp_path / "out")


def test_default_registry_has_builtin_handlers() -> None:
    from src.registry import DEFAULT_REGISTRY

    exts = DEFAULT_REGISTRY.extensions()
    assert ".pdf" in exts
    assert ".docx" in exts
    assert ".html" in exts
    assert ".json" in exts


def test_default_registry_has_new_formats() -> None:
    from src.registry import DEFAULT_REGISTRY

    exts = DEFAULT_REGISTRY.extensions()
    for ext in (".docx", ".pptx", ".xlsx", ".odt", ".ods", ".odp", ".rtf", ".msg", ".eml", ".azw3", ".azw4", ".srt", ".vtt", ".tex"):
        assert ext in exts
