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


def test_cli_ui_options_invoked_correctly(monkeypatch: pytest.MonkeyPatch) -> None:
    called_args: dict[str, object] = {}

    def fake_uvicorn_run(*args: object, **kwargs: object) -> None:
        called_args.update(kwargs)

    monkeypatch.setattr("uvicorn.run", fake_uvicorn_run)
    monkeypatch.setattr("webbrowser.open", lambda *a, **kw: None)

    # Test default ui run -> reload should be False
    res_default = runner.invoke(app, ["ui", "--no-browser", "--port", "9999"])
    assert res_default.exit_code == 0
    assert called_args.get("reload") is False
    assert called_args.get("port") == 9999

    called_args.clear()

    # Test opt-in reload -> reload should be True
    res_reload = runner.invoke(app, ["ui", "--no-browser", "--reload", "--port", "9998"])
    assert res_reload.exit_code == 0
    assert called_args.get("reload") is True
    assert called_args.get("port") == 9998


def test_cli_merge_output_and_loc_combinations(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    f1 = tmp_path / "a.md"
    f1.write_text("Hello A", encoding="utf-8")
    f2 = tmp_path / "b.md"
    f2.write_text("Hello B", encoding="utf-8")

    # 1. --output merged.md --loc=outputs
    res1 = runner.invoke(app, ["merge", "a.md", "b.md", "--output", "merged.md", "--loc", "outputs"])
    assert res1.exit_code == 0
    assert (tmp_path / "outputs" / "merged.md").exists()

    # 2. --output=merged2.md --loc=outputs
    res2 = runner.invoke(app, ["merge", "a.md", "b.md", "--output=merged2.md", "--loc=outputs"])
    assert res2.exit_code == 0
    assert (tmp_path / "outputs" / "merged2.md").exists()

    # 3. --output custom.md (no --loc)
    res3 = runner.invoke(app, ["merge", "a.md", "b.md", "--output", "custom.md"])
    assert res3.exit_code == 0
    assert (tmp_path / "custom.md").exists()

    # 4. --output custom_loc.md --loc ""
    res4 = runner.invoke(app, ["merge", "a.md", "b.md", "--output", "custom_loc.md", "--loc", ""])
    assert res4.exit_code == 0
    assert (tmp_path / "custom_loc.md").exists()

    # 5. --output custom_dot.md --loc=.
    res5 = runner.invoke(app, ["merge", "a.md", "b.md", "--output", "custom_dot.md", "--loc=."])
    assert res5.exit_code == 0
    assert (tmp_path / "custom_dot.md").exists()

    # 6. Invalid output filename with illegal characters
    res6 = runner.invoke(app, ["merge", "a.md", "b.md", "--output", "invalid*file?.md"])
    assert res6.exit_code == 1
    assert "Invalid output filename" in res6.output
