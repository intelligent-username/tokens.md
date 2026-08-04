"""Thread-safe WebSocket manager for per-session event fan-out.

Route handlers run in the threadpool (plain ``def``), so conversion code is
synchronous. :meth:`WsManager.emit` is called from those threads and pushes
events onto a per-session ``asyncio.Queue`` via ``loop.call_soon_threadsafe``.
A per-session forwarding task drains the queue and broadcasts to every socket.
"""

from __future__ import annotations

import asyncio
import threading
import time
from typing import Any

from fastapi import WebSocket

_EVENT_TYPES = ("watch.started", "watch.file", "watch.total", "watch.stopped",
                "progress", "job.done", "log")


class WsManager:
    """Keeps per-session sockets, event queues, and watcher state."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._sockets: dict[str, set[WebSocket]] = {}
        self._queues: dict[str, asyncio.Queue[dict[str, Any]]] = {}
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._stop_events: dict[str, threading.Event] = {}
        self._running: set[str] = set()
        self._totals: dict[str, dict[str, int]] = {}
        self._last_emit: dict[str, float] = {}

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Capture the app event loop so threads can schedule onto it."""
        self._loop = loop

    def register(self, sid: str, ws: WebSocket) -> None:
        """Attach a socket to a session and ensure a forward task exists."""
        with self._lock:
            self._sockets.setdefault(sid, set()).add(ws)
            self._queues.setdefault(sid, asyncio.Queue())
            self._totals.setdefault(
                sid, {"files": 0, "source_tokens": 0, "target_tokens": 0}
            )
            self._stop_events.setdefault(sid, threading.Event())
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if loop is not None and sid not in self._tasks:
            self._tasks[sid] = loop.create_task(self._forward(sid))

    def unregister(self, sid: str, ws: WebSocket) -> None:
        """Detach a socket; stop forwarding when the session goes idle."""
        with self._lock:
            sockets = self._sockets.get(sid)
            if sockets:
                sockets.discard(ws)
                if not sockets:
                    self._sockets.pop(sid, None)
        if not self.has_sockets(sid) and not self.is_running(sid):
            self._cancel_task(sid)

    def has_sockets(self, sid: str) -> bool:
        """True when at least one socket is connected for ``sid``."""
        with self._lock:
            return bool(self._sockets.get(sid))

    def is_running(self, sid: str) -> bool:
        """True while a watch thread is active for ``sid``."""
        with self._lock:
            return sid in self._running

    def start_watch(self, sid: str) -> None:
        with self._lock:
            self._running.add(sid)

    def stop_watch(self, sid: str) -> None:
        with self._lock:
            self._running.discard(sid)

    def get_totals(self, sid: str) -> dict[str, int]:
        """Copy of the running per-file totals for ``sid``."""
        with self._lock:
            return dict(self._totals.get(sid, {}))

    def set_stop(self, sid: str) -> None:
        """Set the per-session watcher stop event."""
        with self._lock:
            event = self._stop_events.get(sid)
        if event is not None:
            event.set()

    def stop_event(self, sid: str) -> threading.Event:
        """Return (creating if needed) the stop event for ``sid``."""
        with self._lock:
            return self._stop_events.setdefault(sid, threading.Event())

    def emit(self, sid: str, event: dict[str, Any]) -> None:
        """Push an event onto the session queue from any thread.

        ``progress`` events are throttled to one per 100 ms per session.
        """
        loop = self._loop
        if loop is None:
            return
        if event.get("type") == "progress":
            now = time.time()
            with self._lock:
                last = self._last_emit.get(sid, 0.0)
                if now - last < 0.1:
                    return
                self._last_emit[sid] = now
        with self._lock:
            queue = self._queues.get(sid)
        if queue is None:
            return
        loop.call_soon_threadsafe(queue.put_nowait, event)

    async def _forward(self, sid: str) -> None:
        """Drain the session queue and broadcast envelopes to all sockets."""
        while True:
            queue = self._queues.get(sid)
            if queue is None:
                return
            event = await queue.get()
            if event.get("type") not in _EVENT_TYPES:
                continue
            sockets = list(self._sockets.get(sid, ()))
            if not sockets:
                continue
            envelope = {
                "type": event.get("type"),
                "session_id": sid,
                "data": event.get("data", {}),
                "ts": time.time(),
            }
            for ws in sockets:
                try:
                    await ws.send_json(envelope)
                except Exception:
                    pass

    def _cancel_task(self, sid: str) -> None:
        task = self._tasks.pop(sid, None)
        if task is None:
            return
        loop = self._loop
        if loop is not None:
            loop.call_soon_threadsafe(task.cancel)

    def shutdown(self) -> None:
        """Cancel all forward tasks and drop session state (app shutdown)."""
        for sid in list(self._tasks):
            self._cancel_task(sid)
        with self._lock:
            self._sockets.clear()
            self._queues.clear()
            self._stop_events.clear()
            self._totals.clear()
            self._running.clear()