"""Tests for the background watcher."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from src.watcher import WatcherHandler, run_watcher


def test_watcher_handler_processes_file(tmp_path: Path) -> None:
    src = tmp_path / "in"
    out = tmp_path / "out"
    src.mkdir()
    out.mkdir()
    (src / "doc.txt").write_text("hello", encoding="utf-8")

    handler = WatcherHandler(out, (".txt",), poll_interval=0.0)
    with patch("src.watcher.resolve_to_markdown", return_value="# Converted"):
        handler._queue.put(src / "doc.txt")  # noqa: SLF001
        handler.drain()

    assert (out / "doc.md").exists()
    assert (out / "doc.md").read_text(encoding="utf-8") == "# Converted"


def test_watcher_error_isolation(tmp_path: Path) -> None:
    src = tmp_path / "in"
    out = tmp_path / "out"
    src.mkdir()
    out.mkdir()
    (src / "doc.txt").write_text("hello", encoding="utf-8")

    handler = WatcherHandler(out, (".txt",), poll_interval=0.0)
    with patch("src.watcher.resolve_to_markdown", side_effect=RuntimeError("boom")):
        handler._queue.put(src / "doc.txt")  # noqa: SLF001
        handler.drain()

    assert not (out / "doc.md").exists()


def test_run_watcher_once(tmp_path: Path) -> None:
    src = tmp_path / "in"
    out = tmp_path / "out"
    src.mkdir()
    (src / "doc.txt").write_text("hello", encoding="utf-8")

    with patch("src.watcher.resolve_to_markdown", return_value="# Converted"):
        run_watcher(src, out, poll_interval=0.0, once=True, extensions=(".txt",))

    assert (out / "doc.md").exists()
