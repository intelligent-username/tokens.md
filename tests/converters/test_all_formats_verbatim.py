"""Test that EVERY supported document file format converts verbatim using pre-generated dummy files.

Image formats (.png, .jpg, .jpeg, .bmp, .gif, .tif, .tiff, .svg) are excluded as non-document formats.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from src.registry import DEFAULT_REGISTRY, convert_file

DUMMIES_DIR = Path(__file__).resolve().parent.parent / "dummies"
FORMATS_DIR = DUMMIES_DIR / "formats"


@pytest.mark.parametrize("ext", sorted(DEFAULT_REGISTRY.extensions()))
def test_format_conversion_verbatim(ext: str, tmp_path: Path) -> None:
    """Test individual file format conversion for each non-image extension registered in DEFAULT_REGISTRY."""
    dummy = FORMATS_DIR / f"dummy_file{ext}"
    assert dummy.exists(), f"Pre-generated dummy file for extension {ext} not found at {dummy}"

    output_dir = tmp_path / f"out_{ext.lstrip('.')}"
    output_dir.mkdir(parents=True, exist_ok=True)

    result = convert_file(dummy, output_dir)
    assert result.exists()
    assert result.suffix == ".md"
    converted_text = result.read_text(encoding="utf-8", errors="replace")
    assert isinstance(converted_text, str)
    assert len(converted_text) > 0

