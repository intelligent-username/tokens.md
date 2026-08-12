"""Background watcher: convert new files added to a hot folder live."""

from __future__ import annotations

import logging
import signal
import threading
import time
from collections.abc import Callable, Sequence
from pathlib import Path
from queue import Empty, Queue
from typing import Any

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from .merger import resolve_to_markdown
from .registry import UnsupportedFormatError

logger = logging.getLogger(__name__)


def _is_matching(path: Path, extensions: Sequence[str]) -> bool:
    return path.is_file() and path.suffix.lower() in {ext.lower() for ext in extensions}


class WatcherHandler(FileSystemEventHandler):
    """Enqueues matching files and processes them once stable."""

    def __init__(self, output_dir: Path, extensions: Sequence[str], poll_interval: float, clip: bool = False, on_event: Callable[[dict[str, object]], None] | None = None, **convert_kwargs: Any) -> None:
        super().__init__()
        self.output_dir = output_dir
        self.extensions = extensions
        self.poll_interval = poll_interval
        self.clip = clip
        self.on_event = on_event
        self.convert_kwargs = convert_kwargs
        self._queue: Queue[Path] = Queue()
        self._processed: set[str] = set()

    # -- watchdog events -------------------------------------------------
    def on_created(self, event: FileSystemEvent) -> None:
        self._enqueue(Path(str(event.src_path)))

    def on_moved(self, event: FileSystemEvent) -> None:
        self._enqueue(Path(str(event.dest_path)))

    def on_modified(self, event: FileSystemEvent) -> None:
        self._enqueue(Path(str(event.src_path)))

    # -- processing ------------------------------------------------------
    def _emit(self, event: str, path: Path, output: Path | None = None, error: str | None = None) -> None:
        if self.on_event is None:
            return
        payload: dict[str, object] = {"event": event, "file": str(path)}
        if output is not None:
            payload["output"] = str(output)
        if error is not None:
            payload["error"] = error
        self.on_event(payload)

    def _enqueue(self, path: Path) -> None:
        if _is_matching(path, self.extensions):
            logger.info("Queued %s", path.name)
            self._queue.put(path)
            self._emit("queued", path)

    def _is_processed(self, path: Path) -> bool:
        key = str(path.resolve())
        if key in self._processed:
            return True
        out_md = self.output_dir / f"{path.stem}.md"
        if out_md.exists() and out_md.stat().st_mtime >= path.stat().st_mtime:
            self._processed.add(key)
            return True
        return False

    def _is_stable(self, path: Path) -> bool:
        try:
            size = path.stat().st_size
        except OSError:
            return False
        time.sleep(self.poll_interval)
        try:
            return path.stat().st_size == size
        except OSError:
            return False

    def process_one(self, path: Path) -> bool:
        """Convert one file; returns True on success. Never raises."""
        if self._is_processed(path):
            self._emit("skipped", path, error="already processed")
            return False
        try:
            if not self._is_stable(path):
                logger.warning("Skipping %s: still changing", path.name)
                self._emit("skipped", path, error="still changing")
                return False
            self._emit("converting", path)
            markdown = resolve_to_markdown(path, **self.convert_kwargs)
            out_path = self.output_dir / f"{path.stem}.md"
            out_path.write_text(markdown, encoding="utf-8")
            if self.clip:
                from .clipboard import copy_to_clipboard

                copy_to_clipboard(markdown)
            self._processed.add(str(path.resolve()))
            self._emit("done", path, output=out_path)
            logger.info("Converted %s -> %s", path.name, out_path.name)
            return True
        except UnsupportedFormatError as exc:
            logger.error("Skipping %s: %s", path.name, exc)
            self._processed.add(str(path.resolve()))
            self._emit("error", path, error=str(exc))
            return False
        except Exception as exc:  # noqa: BLE001 - watcher must keep running
            logger.error("Failed %s: %s", path.name, exc)
            self._processed.add(str(path.resolve()))
            self._emit("error", path, error=str(exc))
            return False

    def drain(self, stop_event: threading.Event | None = None) -> None:
        """Process queued files until empty (or ``stop_event`` is set)."""
        while True:
            if stop_event is not None and stop_event.is_set():
                break
            try:
                path = self._queue.get_nowait()
            except Empty:
                break
            self.process_one(path)


def run_watcher(source: Path, output: Path, *, poll_interval: float, clip: bool = False, once: bool = False, extensions: Sequence[str] = (".pdf",), stop_event: threading.Event | None = None, on_event: Callable[[dict[str, object]], None] | None = None, **convert_kwargs: Any) -> None:
    """Watch ``source`` and convert matching files into ``output``.

    With ``once``, process existing files and return immediately. Otherwise run
    until SIGINT / SIGTERM, exiting cleanly.
    """
    source.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    handler = WatcherHandler(output, extensions, poll_interval, clip, on_event=on_event, **convert_kwargs)

    if once:
        for path in sorted(source.iterdir()):
            if _is_matching(path, extensions):
                handler._queue.put(path)  # noqa: SLF001 - intentional queue access
        handler.drain(stop_event)
        return

    observer = Observer()
    observer.schedule(handler, str(source), recursive=False)
    observer.start()

    stop = stop_event or threading.Event()
    _install_signal_handlers(stop)

    try:
        while not stop.is_set():
            handler.drain(stop)
            time.sleep(poll_interval)
    except KeyboardInterrupt:
        pass
    finally:
        observer.stop()
        observer.join()


def _install_signal_handlers(stop_event: threading.Event) -> None:
    """Wire SIGINT/SIGTERM to set ``stop_event`` for a graceful shutdown."""

    def handler(_signum: int, _frame: Any) -> None:
        stop_event.set()

    for signum in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(signum, handler)
        except (ValueError, OSError):  # not the main thread / unsupported
            continue
