"""Tests for all path argument formats and selection strategies across CLI and file_selector."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from typer.testing import CliRunner

from src.cli import app
from src.file_selector import DirectoryFileSelector, DiscreteFileSelector, GlobPatternFileSelector, select_files

runner = CliRunner()


@pytest.fixture
def complex_workspace(tmp_path: Path) -> Path:
    """Create a structured workspace with various nested directories and files."""
    from docx import Document

    doc = Document()
    doc.add_paragraph("Root document content")
    doc.save(tmp_path / "root_doc.docx")

    (tmp_path / "root_plain.txt").write_text("hello root", encoding="utf-8")


    # docs directory
    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    (docs_dir / "guide.md").write_text("# User Guide\nContent here", encoding="utf-8")
    (docs_dir / "spec.html").write_text("<p>Specification</p>", encoding="utf-8")

    # nested sub-directory: docs/arch
    arch_dir = docs_dir / "arch"
    arch_dir.mkdir()
    (arch_dir / "architecture.md").write_text("# Architecture\nDetails", encoding="utf-8")

    # data directory with multiple formats
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "payload.json").write_text('{"key": "value"}', encoding="utf-8")
    (data_dir / "table.csv").write_text("a,b,c\n1,2,3", encoding="utf-8")

    # empty directory
    (tmp_path / "empty_dir").mkdir()

    return tmp_path


# ==============================================================================
# Unit Tests for select_files() & FileSelector Strategies
# ==============================================================================

def test_select_files_current_dir(complex_workspace: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(complex_workspace)
    files = select_files(".", extensions=(".md", ".txt", ".json", ".csv", ".docx", ".html"))
    filenames = {f.name for f in files}
    assert "root_plain.txt" in filenames
    assert "root_doc.docx" in filenames
    # Non-recursive should not include subfolder files
    assert "guide.md" not in filenames


def test_select_files_current_dir_recursive(complex_workspace: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(complex_workspace)
    files = select_files(".", extensions=(".md", ".txt", ".json", ".csv", ".docx", ".html"), recursive=True)
    filenames = {f.name for f in files}
    assert "root_plain.txt" in filenames
    assert "guide.md" in filenames
    assert "architecture.md" in filenames
    assert "payload.json" in filenames
    assert "table.csv" in filenames


def test_select_files_dir_with_trailing_slash(complex_workspace: Path) -> None:
    docs_slash = str(complex_workspace / "docs") + os.sep
    files = select_files(docs_slash, extensions=(".md", ".html"))
    filenames = {f.name for f in files}
    assert "guide.md" in filenames
    assert "spec.html" in filenames
    assert "architecture.md" not in filenames


def test_select_files_dir_without_trailing_slash(complex_workspace: Path) -> None:
    docs = str(complex_workspace / "docs")
    files = select_files(docs, extensions=(".md", ".html"))
    filenames = {f.name for f in files}
    assert "guide.md" in filenames
    assert "spec.html" in filenames


def test_select_files_relative_subfolder(complex_workspace: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(complex_workspace)
    files = select_files("./docs/arch", extensions=(".md",))
    filenames = {f.name for f in files}
    assert filenames == {"architecture.md"}


def test_select_files_multiple_mixed_sources(complex_workspace: Path) -> None:
    single_file = complex_workspace / "root_plain.txt"
    data_dir = complex_workspace / "data"
    files = select_files([single_file, data_dir], extensions=(".json", ".csv", ".txt"))
    filenames = {f.name for f in files}
    assert "root_plain.txt" in filenames
    assert "payload.json" in filenames
    assert "table.csv" in filenames


def test_select_files_glob_pattern_strategy(complex_workspace: Path) -> None:
    selector = GlobPatternFileSelector("*.json", base_dir=complex_workspace / "data")
    files = selector.select_files()
    assert len(files) == 1
    assert files[0].name == "payload.json"


def test_select_files_discrete_file_strategy(complex_workspace: Path) -> None:
    selector = DiscreteFileSelector([complex_workspace / "root_plain.txt", complex_workspace / "data" / "payload.json"])
    files = selector.select_files()
    assert {f.name for f in files} == {"root_plain.txt", "payload.json"}


# ==============================================================================
# CLI Integration Tests for All Path Arguments
# ==============================================================================

def test_cli_convert_dot_current_dir(complex_workspace: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test `tmd convert . -o out` from working directory."""
    monkeypatch.chdir(complex_workspace)
    out_dir = complex_workspace / "out_dot"
    result = runner.invoke(app, ["convert", ".", "-o", str(out_dir)])
    assert result.exit_code == 0
    assert (out_dir / "root_plain.md").exists()
    assert (out_dir / "root_doc.md").exists()


def test_cli_convert_dir_with_trailing_slash(complex_workspace: Path) -> None:
    """Test `tmd convert docs/ -o out` with trailing slash."""
    docs_path = str(complex_workspace / "docs") + "/"
    out_dir = complex_workspace / "out_slash"
    result = runner.invoke(app, ["convert", docs_path, "-o", str(out_dir)])
    assert result.exit_code == 0
    assert (out_dir / "guide.md").exists()
    assert (out_dir / "spec.md").exists()


def test_cli_convert_dir_without_trailing_slash(complex_workspace: Path) -> None:
    """Test `tmd convert docs -o out` without trailing slash."""
    docs_path = str(complex_workspace / "docs")
    out_dir = complex_workspace / "out_noslash"
    result = runner.invoke(app, ["convert", docs_path, "-o", str(out_dir)])
    assert result.exit_code == 0
    assert (out_dir / "guide.md").exists()
    assert (out_dir / "spec.md").exists()


def test_cli_convert_relative_nested_path(complex_workspace: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test `tmd convert ./docs/arch -o out` relative path."""
    monkeypatch.chdir(complex_workspace)
    out_dir = complex_workspace / "out_nested"
    result = runner.invoke(app, ["convert", "./docs/arch", "-o", str(out_dir)])
    assert result.exit_code == 0
    assert (out_dir / "architecture.md").exists()


def test_cli_convert_recursive_flag(complex_workspace: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test `tmd convert . -r -o out` finding deeply nested files."""
    monkeypatch.chdir(complex_workspace)
    out_dir = complex_workspace / "out_recursive"
    result = runner.invoke(app, ["convert", ".", "-r", "-o", str(out_dir)])
    assert result.exit_code == 0
    assert (out_dir / "root_plain.md").exists()
    assert (out_dir / "guide.md").exists()
    assert (out_dir / "architecture.md").exists()
    assert (out_dir / "payload.md").exists()
    assert (out_dir / "table.md").exists()


def test_cli_convert_single_specific_file(complex_workspace: Path) -> None:
    """Test `tmd convert path/to/file.json -o out`."""
    target_file = complex_workspace / "data" / "payload.json"
    out_dir = complex_workspace / "out_single"
    result = runner.invoke(app, ["convert", str(target_file), "-o", str(out_dir)])
    assert result.exit_code == 0
    assert (out_dir / "payload.md").exists()


def test_cli_convert_multiple_discrete_files(complex_workspace: Path) -> None:
    """Test `tmd convert file1 file2 file3 -o out`."""
    f1 = complex_workspace / "root_plain.txt"
    f2 = complex_workspace / "data" / "table.csv"
    out_dir = complex_workspace / "out_multi_files"
    result = runner.invoke(app, ["convert", str(f1), str(f2), "-o", str(out_dir)])
    assert result.exit_code == 0
    assert (out_dir / "root_plain.md").exists()
    assert (out_dir / "table.md").exists()


def test_cli_convert_multiple_singular_pdfs(tmp_path: Path) -> None:
    """Test `tmd convert a.pdf b.pdf c.pdf -o out` passing multiple distinct PDF files."""
    import pymupdf

    pdf_files: list[Path] = []
    for name in ("first.pdf", "second.pdf", "third.pdf"):
        p = tmp_path / name
        doc = pymupdf.open()
        page = doc.new_page()
        page.insert_text((72, 72), f"Content in {name}")
        doc.save(str(p))
        doc.close()
        pdf_files.append(p)

    out_dir = tmp_path / "out_pdfs"
    result = runner.invoke(app, ["convert", str(pdf_files[0]), str(pdf_files[1]), str(pdf_files[2]), "-o", str(out_dir)])
    assert result.exit_code == 0
    assert (out_dir / "first.md").exists()
    assert (out_dir / "second.md").exists()
    assert (out_dir / "third.md").exists()
    assert "Content in first.pdf" in (out_dir / "first.md").read_text(encoding="utf-8")



def test_cli_convert_mixed_directory_and_files(complex_workspace: Path) -> None:
    """Test `tmd convert ./docs data/table.csv -o out` (mix of dir and file paths)."""
    docs_dir = complex_workspace / "docs"
    csv_file = complex_workspace / "data" / "table.csv"
    out_dir = complex_workspace / "out_mixed"
    result = runner.invoke(app, ["convert", str(docs_dir), str(csv_file), "-o", str(out_dir)])
    assert result.exit_code == 0
    assert (out_dir / "guide.md").exists()
    assert (out_dir / "spec.md").exists()
    assert (out_dir / "table.md").exists()


def test_cli_convert_with_loc_flag(complex_workspace: Path) -> None:
    """Test `--loc=custom_folder` as output flag."""
    f1 = complex_workspace / "data" / "payload.json"
    out_loc = complex_workspace / "custom_loc"
    result = runner.invoke(app, ["convert", str(f1), f"--loc={out_loc}"])
    assert result.exit_code == 0
    assert (out_loc / "payload.md").exists()


def test_cli_convert_with_extensions_filter(complex_workspace: Path) -> None:
    """Test `-e json` only converts specified extensions in folder."""
    data_dir = complex_workspace / "data"
    out_dir = complex_workspace / "out_filtered"
    result = runner.invoke(app, ["convert", str(data_dir), "-e", "json", "-o", str(out_dir)])
    assert result.exit_code == 0
    assert (out_dir / "payload.md").exists()
    assert not (out_dir / "table.md").exists()


def test_cli_convert_merge_all_sources(complex_workspace: Path) -> None:
    """Test `tmd convert ./docs ./data -m -o out/merged.md`."""
    docs_dir = complex_workspace / "docs"
    data_dir = complex_workspace / "data"
    out_dir = complex_workspace / "out_merged"
    result = runner.invoke(app, ["convert", str(docs_dir), str(data_dir), "-m", "-o", str(out_dir)])
    assert result.exit_code == 0
    assert (out_dir / "merged.md").exists()
    merged_text = (out_dir / "merged.md").read_text(encoding="utf-8")
    assert "User Guide" in merged_text
    assert "table.md" in merged_text
    assert "payload.md" in merged_text
    assert "| a | b | c |" in merged_text



def test_cli_convert_nonexistent_path_fails(complex_workspace: Path) -> None:
    """Test that nonexistent paths exit with code 1."""
    nonexistent = complex_workspace / "does_not_exist"
    result = runner.invoke(app, ["convert", str(nonexistent), "-o", str(complex_workspace / "out")])
    assert result.exit_code == 1


def test_cli_convert_spaces_and_long_filenames(tmp_path: Path) -> None:
    """Test converting files with spaces and very long filenames."""
    space_file = tmp_path / "my document with spaces.txt"
    space_file.write_text("content with spaces", encoding="utf-8")

    long_name = "a" * 80 + "_long_document.txt"
    long_file = tmp_path / long_name
    long_file.write_text("long name content", encoding="utf-8")

    out_dir = tmp_path / "out_edge"
    res = runner.invoke(app, ["convert", str(space_file), str(long_file), "-o", str(out_dir)])
    assert res.exit_code == 0
    assert (out_dir / "my document with spaces.md").exists()
    assert (out_dir / f"{'a' * 80}_long_document.md").exists()


def test_cli_convert_nested_subdirectories(tmp_path: Path) -> None:
    """Test converting files located in different nested subdirectories."""
    sub1 = tmp_path / "deep" / "nested" / "sub1"
    sub1.mkdir(parents=True)
    f1 = sub1 / "file1.txt"
    f1.write_text("Sub 1 content", encoding="utf-8")

    sub2 = tmp_path / "other" / "branch" / "sub2"
    sub2.mkdir(parents=True)
    f2 = sub2 / "file2.txt"
    f2.write_text("Sub 2 content", encoding="utf-8")

    out_dir = tmp_path / "out_subdirs"
    res = runner.invoke(app, ["convert", str(f1), str(f2), "-o", str(out_dir)])
    assert res.exit_code == 0
    assert (out_dir / "file1.md").exists()
    assert (out_dir / "file2.md").exists()

