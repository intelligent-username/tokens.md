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


# --- Reader-backed formats -------------------------------------------------


def test_docx_reader_infers_headings(sample_docx_headed: Path, tmp_path: Path) -> None:
    out = _convert(sample_docx_headed, tmp_path)
    text = out.read_text(encoding="utf-8")
    assert "# Chapter One" in text
    assert "Hello from python-docx." in text


def test_pptx_reader(sample_pptx: Path, tmp_path: Path) -> None:
    out = _convert(sample_pptx, tmp_path)
    text = out.read_text(encoding="utf-8")
    assert "## Slide 1" in text
    assert "Hello slides" in text


def test_xlsx_reader(sample_xlsx: Path, tmp_path: Path) -> None:
    out = _convert(sample_xlsx, tmp_path)
    text = out.read_text(encoding="utf-8")
    assert "| name | age |" in text
    assert "alice" in text


def test_odf_reader(sample_odt: Path, tmp_path: Path) -> None:
    out = _convert(sample_odt, tmp_path)
    text = out.read_text(encoding="utf-8")
    assert "Hello from ODF" in text


def test_rtf_reader(sample_rtf: Path, tmp_path: Path) -> None:
    out = _convert(sample_rtf, tmp_path)
    assert "Hello" in out.read_text(encoding="utf-8")


def test_eml_reader(sample_eml: Path, tmp_path: Path) -> None:
    out = _convert(sample_eml, tmp_path)
    text = out.read_text(encoding="utf-8")
    assert "# Hello" in text
    assert "Body text." in text


def test_srt_reader(sample_srt: Path, tmp_path: Path) -> None:
    out = _convert(sample_srt, tmp_path)
    assert "Hello" in out.read_text(encoding="utf-8")


def test_tex_reader(sample_tex: Path, tmp_path: Path) -> None:
    out = _convert(sample_tex, tmp_path)
    text = out.read_text(encoding="utf-8")
    assert "# Introduction" in text
    assert "Some body text" in text


def test_azw4_reader_routes_to_pdf_engine(sample_azw4: Path, tmp_path: Path) -> None:
    # AZW4 is a PDF wrapper; assert it converts via the pymupdf path.
    out = _convert(sample_azw4, tmp_path)
    assert "Hello from tokens.md" in out.read_text(encoding="utf-8")


def test_msg_reader_failure_is_friendly(tmp_path: Path) -> None:
    # A corrupt/non-MSG file must raise a clear UnsupportedFormatError.
    bad = tmp_path / "fake.msg"
    bad.write_bytes(b"not an OLE file")
    with pytest.raises(UnsupportedFormatError):
        _convert(bad, tmp_path)


# --- Math fidelity ---------------------------------------------------------


def test_docx_math_spliced_as_latex(sample_docx_math: Path, tmp_path: Path) -> None:
    out = _convert(sample_docx_math, tmp_path)
    text = out.read_text(encoding="utf-8")
    assert "$$" in text                      # display math delimiter present
    assert "x^{2}" in text or "x^2" in text   # superscript converted


def test_tex_math_preserved_verbatim(sample_tex_math: Path, tmp_path: Path) -> None:
    out = _convert(sample_tex_math, tmp_path)
    text = out.read_text(encoding="utf-8")
    assert "$E = mc^2$" in text
    assert "\\begin{equation}" in text
    assert "\\int_0^1 x^2 dx" in text


def test_omml_converter_node_types() -> None:
    from xml.etree import ElementTree as ET

    from src.omml import omath_element_to_latex

    # fraction: m:f -> \frac{a}{b}
    frac = ET.fromstring(
        '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">'
        '<m:f><m:num><m:r><m:t>a</m:t></m:r></m:num>'
        '<m:den><m:r><m:t>b</m:t></m:r></m:den></m:f></m:oMath>'
    )
    assert "\\frac{a}{b}" in omath_element_to_latex(frac)


def test_mathml_converter_node_types() -> None:
    from src.mathml import mathml_to_latex

    # mfrac -> \frac{a}{b}
    assert "\\frac{a}{b}" in mathml_to_latex(
        '<math xmlns="http://www.w3.org/1998/Math/MathML">'
        "<mfrac><mi>a</mi><mi>b</mi></mfrac></math>"
    )
    # msup -> {x}^{2}
    assert "{x}^{2}" in mathml_to_latex(
        '<math xmlns="http://www.w3.org/1998/Math/MathML">'
        "<msup><mi>x</mi><mn>2</mn></msup></math>"
    )
    # unknown node -> fenced raw fallback, never empty, never raises
    assert mathml_to_latex("<math><bogus/></math>").startswith("```mathml")