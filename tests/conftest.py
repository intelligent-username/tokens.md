"""Shared fixtures for the tokens.md test suite."""

from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path

import pytest


@pytest.fixture
def tmd_workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the workspace temp dir at a per-test tmp_path."""
    monkeypatch.setattr(tempfile, "gettempdir", lambda: str(tmp_path))
    return tmp_path


@pytest.fixture
def client(tmd_workspace: Path):
    """FastAPI TestClient with an isolated temp workspace."""
    from backend.app import create_app
    from fastapi.testclient import TestClient

    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def tmp_output(tmp_path: Path) -> Path:
    out = tmp_path / "output"
    out.mkdir()
    return out


@pytest.fixture
def sample_pdf(tmp_path: Path) -> Path:
    """Generate a minimal single-page PDF containing known text."""
    import pymupdf

    pdf_path = tmp_path / "sample.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Hello from tokens.md")
    doc.save(str(pdf_path))
    doc.close()
    return pdf_path


@pytest.fixture
def sample_md(tmp_path: Path) -> Path:
    path = tmp_path / "notes.md"
    path.write_text("# Notes\n\nSome markdown content here.\n", encoding="utf-8")
    return path


@pytest.fixture
def sample_docx(tmp_path: Path) -> Path:
    path = tmp_path / "letter.docx"
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>"
        "<w:p><w:r><w:t>Dear friend</w:t></w:r></w:p>"
        "<w:p><w:r><w:t>This is a letter.</w:t></w:r></w:p>"
        "</w:body></w:document>"
    )
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("word/document.xml", document)
    return path


@pytest.fixture
def sample_csv(tmp_path: Path) -> Path:
    path = tmp_path / "data.csv"
    path.write_text("name,age\nalice,30\nbob,25\n", encoding="utf-8")
    return path


@pytest.fixture
def sample_json(tmp_path: Path) -> Path:
    path = tmp_path / "config.json"
    path.write_text('{"host": "localhost", "port": 8080}', encoding="utf-8")
    return path


@pytest.fixture
def sample_txt(tmp_path: Path) -> Path:
    path = tmp_path / "readme.txt"
    path.write_text("Plain text content.\n", encoding="utf-8")
    return path


@pytest.fixture
def sample_html(tmp_path: Path) -> Path:
    path = tmp_path / "page.html"
    path.write_text(
        "<html><body><article><h1>Title</h1><p>Body text here.</p></article></body></html>",
        encoding="utf-8",
    )
    return path
