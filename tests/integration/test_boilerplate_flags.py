"""End-to-end CLI tests for boilerplate stripping and budget-gated collapse."""

from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

from src.cli import app

runner = CliRunner()

HEADER = "Field Notes - Chapter Overview"
FOOTER = "Confidential Draft"
PAGE_COUNT = 6


@pytest.fixture()
def multipage_pdf(tmp_path: Path) -> Path:
    """Generate a six-page PDF with repeating page furniture."""
    pymupdf = pytest.importorskip("pymupdf")
    pdf_path = tmp_path / "report.pdf"
    doc = pymupdf.open()
    for i in range(1, PAGE_COUNT + 1):
        page = doc.new_page()
        page.insert_text((50, 40), HEADER)
        page.insert_text((50, 100), f"Unique body content for page {i} about topic number {i}.")
        page.insert_text((50, 160), f"Additional distinct paragraph for page {i} with more words here.")
        page.insert_text((280, 780), str(i))
        page.insert_text((50, 800), FOOTER)
    doc.save(str(pdf_path))
    doc.close()
    return pdf_path


def _convert(tmp_path: Path, pdf: Path, name: str, *flags: str) -> str:
    out = tmp_path / name
    result = runner.invoke(app, ["convert", str(pdf), "-o", str(out), *flags])
    assert result.exit_code == 0
    return (out / "report.md").read_text(encoding="utf-8")


def test_convert_default_strips_page_numbers_only(multipage_pdf: Path) -> None:
    md = _convert(multipage_pdf.parent, multipage_pdf, "out_default")
    assert HEADER in md
    assert FOOTER in md


def test_convert_budget_strips_headers_too(multipage_pdf: Path) -> None:
    md = _convert(multipage_pdf.parent, multipage_pdf, "out_budget", "--budget", "100000")
    assert HEADER not in md
    assert FOOTER not in md


def test_convert_keep_boilerplate_restores_everything(multipage_pdf: Path) -> None:
    md = _convert(multipage_pdf.parent, multipage_pdf, "out_keep", "--keep-boilerplate")
    assert HEADER in md
    assert FOOTER in md


def test_merge_budget_collapses_duplicates(tmp_path: Path) -> None:
    paragraph = "The migration pipeline processes each batch sequentially and retries failed rows up to three times before logging them."
    shared = tmp_path / "shared.md"
    shared.write_text(f"# Shared\n\n{paragraph}\n", encoding="utf-8")
    dup = tmp_path / "dup.md"
    dup.write_text(f"# Duplicate\n\n{paragraph}\n", encoding="utf-8")

    out_budget = tmp_path / "merged_budget.md"
    result = runner.invoke(app, ["merge", str(shared), str(dup), "-o", str(out_budget), "--budget", "100000"])
    assert result.exit_code == 0
    assert "(repeated from §" in out_budget.read_text(encoding="utf-8")

    out_plain = tmp_path / "merged_plain.md"
    result = runner.invoke(app, ["merge", str(shared), str(dup), "-o", str(out_plain)])
    assert result.exit_code == 0
    assert "(repeated from §" not in out_plain.read_text(encoding="utf-8")


def test_watch_budget_prunes_output(tmp_path: Path) -> None:
    from src.watcher import WatcherHandler

    source = tmp_path / "inbox"
    output = tmp_path / "out"
    source.mkdir()
    output.mkdir()

    long_text = "\n".join(f"Sentence number {i} adds filler content to the document." for i in range(60))
    incoming = source / "notes.txt"
    incoming.write_text(long_text, encoding="utf-8")

    handler = WatcherHandler(output, (".txt",), poll_interval=0.0, budget=50)
    assert handler.process_one(incoming) is True

    written = (output / "notes.md").read_text(encoding="utf-8")
    from src.tokenizer import count_tokens

    assert count_tokens(written) <= 50
