"""Background janitor thread and workspace cleanup logic."""

from __future__ import annotations

import shutil
import tempfile
import threading
import time
from pathlib import Path

from .constants import JANITOR_CHECK_INTERVAL_SEC, SECONDS_PER_HOUR, WORKSPACE_DIR_PREFIX


def start_janitor(ttl_hours: int) -> threading.Event:
    """Start a daemon janitor thread; return a stop event."""
    stop = threading.Event()
    thread = threading.Thread(target=_janitor_loop, args=(ttl_hours, stop), daemon=True)
    thread.start()
    return stop


def _janitor_loop(ttl_hours: int, stop: threading.Event) -> None:
    while not stop.wait(JANITOR_CHECK_INTERVAL_SEC):
        sweep_workspaces(ttl_hours)


def sweep_workspaces(ttl_hours: int) -> None:
    """Delete ``tmd-ui-*`` dirs in the temp dir older than ``ttl_hours``."""
    cutoff = time.time() - ttl_hours * SECONDS_PER_HOUR
    pattern = f"{WORKSPACE_DIR_PREFIX}*"
    for child in Path(tempfile.gettempdir()).glob(pattern):
        if not child.is_dir():
            continue
        try:
            mtime = child.stat().st_mtime
        except OSError:
            continue
        if mtime < cutoff:
            shutil.rmtree(child, ignore_errors=True)


def cleanup_all() -> None:
    """Remove every ``tmd-ui-*`` temp dir (shutdown hygiene)."""
    pattern = f"{WORKSPACE_DIR_PREFIX}*"
    for child in Path(tempfile.gettempdir()).glob(pattern):
        shutil.rmtree(child, ignore_errors=True)
