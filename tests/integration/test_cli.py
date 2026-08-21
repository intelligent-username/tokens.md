"""Tests for the Typer CLI."""

from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from src.cli import app

runner = CliRunner()


def test_version() -> None:
    result = runner.invoke(app, ["--version"])
    assert result.exit_code == 0
    assert "tmd" in result.output


def test_help_lists_subcommands() -> None:
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    for cmd in ("convert", "watch", "fetch", "repo", "merge"):
        assert cmd in result.output


def test_convert_file(sample_pdf: Path, tmp_path: Path) -> None:
    out = tmp_path / "out"
    result = runner.invoke(app, ["convert", str(sample_pdf), "-o", str(out)])
    assert result.exit_code == 0
    assert (out / "sample.md").exists()


def test_convert_unsupported_exits_1(tmp_path: Path) -> None:
    bad = tmp_path / "blob.xyz"
    bad.write_text("data", encoding="utf-8")
    result = runner.invoke(app, ["convert", str(bad), "-o", str(tmp_path / "out")])
    assert result.exit_code == 1


def test_merge(sample_md: Path, tmp_path: Path) -> None:
    out = tmp_path / "merged.md"
    result = runner.invoke(app, ["merge", str(sample_md), "-o", str(out)])
    assert result.exit_code == 0
    assert out.exists()
    assert "=== FILE:" in out.read_text(encoding="utf-8")


def test_delta(sample_md: Path, tmp_path: Path) -> None:
    out = tmp_path / "out"
    out.mkdir()
    (out / "notes.md").write_text("# Notes\n\nSome markdown content here.\n", encoding="utf-8")
    result = runner.invoke(app, ["delta", str(sample_md), "-o", str(out)])
    assert result.exit_code == 0
    assert "tokens" in result.output


def test_clip_supports_all_formats(sample_docx_headed: Path, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    captured: dict[str, str] = {}
    monkeypatch.setattr("src.clipboard.copy_to_clipboard", lambda text: captured.setdefault("text", text))
    result = runner.invoke(app, ["convert", str(sample_docx_headed), "--clip"])
    assert result.exit_code == 0
    assert "# Chapter One" in captured.get("text", "")
    assert "Hello from python-docx." in captured.get("text", "")
    # Verify no file is written to current directory or output folder
    assert not (tmp_path / "sample_docx_headed.md").exists()
    assert not (tmp_path / "output").exists()


def test_clip_with_merge_copies_to_clipboard_without_disk_writes(sample_docx_headed: Path, sample_pdf: Path, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    captured: dict[str, str] = {}
    monkeypatch.setattr("src.clipboard.copy_to_clipboard", lambda text: captured.setdefault("text", text))
    result = runner.invoke(app, ["convert", str(sample_docx_headed), str(sample_pdf), "-m", "--clip"])
    assert result.exit_code == 0
    text = captured.get("text", "")
    assert "### Table of Contents" in text
    assert "Hello from python-docx." in text
    assert "Hello from tokens.md" in text
    # Verify no merged file is written to disk
    assert not (tmp_path / "merged.md").exists()
    assert not (tmp_path / "output").exists()

