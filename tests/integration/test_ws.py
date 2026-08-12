"""Tests for the WebSocket manager in backend.ws."""

from __future__ import annotations

import asyncio
from collections.abc import Coroutine
from typing import Any, TypeVar

from backend.ws import WsManager

T = TypeVar("T")


class FakeWebSocket:
    """Minimal stand-in for fastapi.WebSocket that records sent envelopes."""

    def __init__(self) -> None:
        self.sent: list[dict[str, object]] = []

    async def send_json(self, envelope: dict[str, object]) -> None:
        self.sent.append(envelope)


def _run(coro: Coroutine[Any, Any, T]) -> T:
    """Run an async scenario and return its result."""
    return asyncio.run(coro)


async def _scenario_emit() -> list[dict[str, object]]:
    manager = WsManager()
    manager.bind_loop(asyncio.get_running_loop())
    ws = FakeWebSocket()
    manager.register("s1", ws)  # type: ignore[arg-type]
    manager.emit("s1", {"type": "watch.file", "data": {"file": "a.md"}})
    await asyncio.sleep(0.05)
    manager.unregister("s1", ws)  # type: ignore[arg-type]
    await asyncio.sleep(0.05)
    manager.shutdown()
    return ws.sent


def test_emit_delivers_to_subscriber() -> None:
    sent = _run(_scenario_emit())
    assert len(sent) == 1
    assert sent[0]["type"] == "watch.file"
    assert sent[0]["session_id"] == "s1"
    assert sent[0]["data"] == {"file": "a.md"}


async def _scenario_throttle() -> list[dict[str, object]]:
    manager = WsManager()
    manager.bind_loop(asyncio.get_running_loop())
    ws = FakeWebSocket()
    manager.register("s1", ws)  # type: ignore[arg-type]
    for _ in range(10):
        manager.emit("s1", {"type": "progress", "data": {"n": 1}})
    await asyncio.sleep(0.05)
    manager.unregister("s1", ws)  # type: ignore[arg-type]
    await asyncio.sleep(0.05)
    manager.shutdown()
    return ws.sent


def test_throttle_coalesces_rapid_progress() -> None:
    sent = _run(_scenario_throttle())
    assert len(sent) == 1


async def _scenario_shutdown() -> bool:
    manager = WsManager()
    manager.bind_loop(asyncio.get_running_loop())
    ws = FakeWebSocket()
    manager.register("s1", ws)  # type: ignore[arg-type]
    manager.start_watch("s1")
    manager.shutdown()
    await asyncio.sleep(0.05)
    return (
        not manager.has_sockets("s1") and not manager.is_running("s1") and manager.get_totals("s1") == {} and "s1" not in manager._tasks  # noqa: SLF001 - lifecycle check
    )


def test_shutdown_clears_sessions() -> None:
    assert _run(_scenario_shutdown()) is True


def test_watch_start_stop_lifecycle() -> None:
    manager = WsManager()
    assert not manager.is_running("s1")
    manager.start_watch("s1")
    assert manager.is_running("s1")
    manager.stop_watch("s1")
    assert not manager.is_running("s1")


def test_stop_event() -> None:
    manager = WsManager()
    event = manager.stop_event("s1")
    assert not event.is_set()
    manager.set_stop("s1")
    assert event.is_set()


async def _scenario_unregister_cancels_task() -> bool:
    manager = WsManager()
    manager.bind_loop(asyncio.get_running_loop())
    ws = FakeWebSocket()
    manager.register("s1", ws)  # type: ignore[arg-type]
    assert "s1" in manager._tasks  # noqa: SLF001 - lifecycle check
    manager.unregister("s1", ws)  # type: ignore[arg-type]
    await asyncio.sleep(0.05)
    result = "s1" not in manager._tasks  # noqa: SLF001 - lifecycle check
    manager.shutdown()
    return result


def test_unregister_cancels_idle_task() -> None:
    assert _run(_scenario_unregister_cancels_task()) is True
