"""Unit tests for workspace janitor and temp cleanup."""

from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

from backend.workspace_support.constants import WORKSPACE_DIR_PREFIX
from backend.workspace_support.janitor import cleanup_all, start_janitor, sweep_workspaces


def test_sweep_workspaces_deletes_old_and_keeps_recent(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(tempfile, "gettempdir", lambda: str(tmp_path))

    old_dir = tmp_path / f"{WORKSPACE_DIR_PREFIX}old_session"
    old_dir.mkdir()
    (old_dir / "file.txt").write_text("old", encoding="utf-8")

    recent_dir = tmp_path / f"{WORKSPACE_DIR_PREFIX}recent_session"
    recent_dir.mkdir()
    (recent_dir / "file.txt").write_text("recent", encoding="utf-8")

    other_dir = tmp_path / "other_app_dir"
    other_dir.mkdir()

    # Set old_dir mtime to 10 hours ago
    ten_hours_ago = time.time() - 36000
    os.utime(old_dir, (ten_hours_ago, ten_hours_ago))

    # Sweep with 2 hour TTL
    sweep_workspaces(ttl_hours=2)

    assert not old_dir.exists()
    assert recent_dir.exists()
    assert other_dir.exists()


def test_cleanup_all_removes_all_workspaces(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(tempfile, "gettempdir", lambda: str(tmp_path))

    d1 = tmp_path / f"{WORKSPACE_DIR_PREFIX}session_1"
    d1.mkdir()
    d2 = tmp_path / f"{WORKSPACE_DIR_PREFIX}session_2"
    d2.mkdir()
    d3 = tmp_path / "not_tmd_dir"
    d3.mkdir()

    cleanup_all()

    assert not d1.exists()
    assert not d2.exists()
    assert d3.exists()


def test_start_janitor_thread() -> None:
    stop_event = start_janitor(ttl_hours=24)
    assert not stop_event.is_set()
    stop_event.set()
    assert stop_event.is_set()
