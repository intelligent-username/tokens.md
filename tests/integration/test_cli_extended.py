"""Integration tests for extended CLI commands (repo, fetch, merge options, ui/lint/test helpers)."""

from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

from src.cli import app

runner = CliRunner()


def test_cli_repo_command(tmp_path: Path) -> None:
    # Setup dummy mini-repo
    repo_dir = tmp_path / "mini_repo"
    repo_dir.mkdir()
    (repo_dir / "main.py").write_text("print('hello')", encoding="utf-8")
    (repo_dir / "README.md").write_text("# Project\nDocs", encoding="utf-8")

    out_dir = tmp_path / "out_repo"
    result = runner.invoke(app, ["repo", str(repo_dir), "-o", str(out_dir), "-f"])
    assert result.exit_code == 0
    assert (out_dir / "mini_repo.md").exists()
    content = (out_dir / "mini_repo.md").read_text(encoding="utf-8")
    assert "main.py" in content


def test_cli_fetch_command_mocked(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_fetch_url(url: str, output_dir: Path) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        out = output_dir / "article.md"
        out.write_text("# Article\nFetched content.", encoding="utf-8")
        return out

    monkeypatch.setattr("src.fetch.fetch_url", fake_fetch_url)
    out_dir = tmp_path / "out_fetch"
    result = runner.invoke(app, ["fetch", "https://example.com", "-o", str(out_dir)])
    assert result.exit_code == 0
    assert (out_dir / "article.md").exists()


def test_cli_merge_with_budget_and_no_toc(tmp_path: Path) -> None:
    f1 = tmp_path / "doc1.md"
    f1.write_text("# Section 1\n" + "Word " * 50, encoding="utf-8")
    f2 = tmp_path / "doc2.md"
    f2.write_text("# Section 2\n" + "Text " * 50, encoding="utf-8")

    out_file = tmp_path / "merged_budget.md"
    result = runner.invoke(app, ["merge", str(f1), str(f2), "-o", str(out_file), "--budget", "50", "--no-toc", "--delta"])
    assert result.exit_code == 0
    assert out_file.exists()
    content = out_file.read_text(encoding="utf-8")
    assert "### Table of Contents" not in content


def test_cli_lint_and_test_missing_scripts_exit_gracefully(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    # Neither scripts/lint.py nor scripts/test.py exist in empty tmp_path
    res_lint = runner.invoke(app, ["lint"])
    assert res_lint.exit_code == 1
    assert "Developer scripts" in res_lint.output

    res_test = runner.invoke(app, ["test"])
    assert res_test.exit_code == 1
    assert "Developer scripts" in res_test.output
